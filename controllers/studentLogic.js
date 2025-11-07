// controllers/uploadController.js

const mongoose = require('mongoose');
const student = require('../model/customerModel');
const Assignment = require('../model/assignmentSchema')
const ContactLater = require('../model/contactLaterSchema')
const ALLOWED = ['name', 'email', 'phone', 'course', 'place'];
const Admission = require('../model/admissionSchema')
const CallSession = require('../model/callsessionSchema')
const WorkReport = require('../model/workReportSchema');


const uploadSheetDetails = async (req, res) => {
  function isValidName(name) { return /^[A-Za-z\s'-]{2,50}$/.test(name); }
  function isEmail(v) {
    if (!v) return false;
    return /^([\w-.]+@([\w-]+\.)+[\w-]{2,})$/.test(String(v).toLowerCase());
  }
  function isValidPhone(phone) { return /^\d{10}$/.test(phone); }
  function isValidCourse(course) { return /^[A-Za-z\s]{2,100}$/.test(course); }
  function isValidPlace(place) { return /^[A-Za-z\s]{2,100}$/.test(place); }

  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'no_data', message: 'Data array is empty or missing' });
    }

    // Normalize keys in first record, check required fields
    const first = data[0] || {};
    const firstKeys = Object.keys(first).map(k => String(k).toLowerCase().trim());
    const missing = ALLOWED.filter(k => !firstKeys.includes(k));
    if (missing.length > 0) {
      return res.status(400).json({ error: 'columns_mismatch', missing, expected: ALLOWED });
    }

    const invalidRows = [];
    const alreadyExisting = [];  // new: to collect which input rows correspond to already-existing docs

    // First: find which inputs already exist in DB
    // Build queries
    // For efficiency, you can do something like:
    //   student.find({ $or: [ { email: { $in: allEmails } }, { phone: { $in: allPhones } } ] })
    // Then for each such existing record, map back to the input rows.

    // Extract all emails / phones from data
    const emails = [];
    const phones = [];
    data.forEach((row, idx) => {
      const lowerRow = {};
      Object.keys(row).forEach(k => {
        lowerRow[String(k).toLowerCase().trim()] = row[k];
      });
      const rec = {};
      ALLOWED.forEach(field => {
        const val = lowerRow[field] !== undefined && lowerRow[field] !== null
          ? String(lowerRow[field]).trim()
          : '';
        rec[field] = val;
      });
      // store for matching
      if (rec.email) emails.push(rec.email);
      if (rec.phone) phones.push(rec.phone);
    });

    // Query existing docs
    const existingDocs = await student.find({
      $or: [
        { email: { $in: emails } },
        { phone: { $in: phones } }
      ]
    }).lean();

    // Now map existingDocs so we can check each input row
    const existingEmailsSet = new Set(existingDocs.map(doc => doc.email));
    const existingPhonesSet = new Set(existingDocs.map(doc => doc.phone));

    // Build bulkOps only for inputs (if you want upsert, you may still upsert but mark existing)
    const bulkOps = [];

    data.forEach((row, idx) => {
      // normalize row
      const lowerRow = {};
      Object.keys(row || {}).forEach(k => {
        lowerRow[String(k).toLowerCase().trim()] = row[k];
      });
      const rec = {};
      ALLOWED.forEach(field => {
        const val = lowerRow[field] !== undefined && lowerRow[field] !== null
          ? String(lowerRow[field]).trim()
          : '';
        rec[field] = val;
      });

      // validate
      const rowErrors = [];
      if (!rec.name) rowErrors.push('name missing');
      else if (!isValidName(rec.name)) rowErrors.push('name invalid; only letters, spaces, hyphen allowed, length 2-50');

      if (!rec.email) rowErrors.push('email missing');
      else if (!isEmail(rec.email)) rowErrors.push('email invalid');

      if (!rec.phone) rowErrors.push('phone missing');
      else if (!isValidPhone(rec.phone)) rowErrors.push('phone invalid; must be 10 digits');

      if (!rec.course) rowErrors.push('course missing');
      else if (!isValidCourse(rec.course)) rowErrors.push('course invalid');

      if (!rec.place) rowErrors.push('place missing');
      else if (!isValidPlace(rec.place)) rowErrors.push('place invalid');

      if (rowErrors.length > 0) {
        invalidRows.push({ rowIndex: idx, errors: rowErrors, rec });
        return;
      }

      // check if this rec already exists
      if (existingEmailsSet.has(rec.email) || existingPhonesSet.has(rec.phone)) {
        alreadyExisting.push({ rowIndex: idx, rec });
      }

      // still include in bulk write (using upsert: true) so it updates existing or inserts new
      const filter = {
        $or: [
          { email: rec.email },
          { phone: rec.phone }
        ]
      };
      const setObj = {};
      const setOnInsert = {};
      ALLOWED.forEach(f => {
        if (rec[f] !== '') setObj[f] = rec[f];
        else setOnInsert[f] = rec[f];
      });
      const update = {};
      if (Object.keys(setObj).length) update.$set = setObj;
      if (Object.keys(setOnInsert).length) update.$setOnInsert = setOnInsert;

      bulkOps.push({
        updateOne: {
          filter,
          update,
          upsert: true
        }
      });
    });

    if (bulkOps.length === 0) {
      return res.json({
        insertedCount: 0,
        modifiedCount: 0,
        invalidCount: invalidRows.length,
        invalidRows,
        alreadyExisting  // new
      });
    }

    const bulkResult = await student.bulkWrite(bulkOps, { ordered: false });

    const insertedCount = bulkResult.upsertedCount || bulkResult.insertedCount || 0;
    const modifiedCount = bulkResult.modifiedCount || bulkResult.nModified || 0;

    return res.json({
      insertedCount,
      modifiedCount,
      invalidCount: invalidRows.length,
      invalidRows,
      alreadyExisting   // new: send to frontend
    });

  } catch (err) {
    console.error('Upload error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'duplicate_key', message: err.message });
    }
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};

const viewStudController = async (req, res) => {
  try {
    const students = await student.find().populate('assignedTo', 'username') // Populate only the 'username' field
      .exec(); // remove __v if you want
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Server error fetching students' });
  }
}

const editStudController = async (req, res) => {
  try {
    const updatedStudent = await student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(updatedStudent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

const deleteStudController = async (req, res) => {
  const { id } = req.params;

  try {
    // Validate the ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    // Find and delete the student
    const Student = await student.findByIdAndDelete(id);

    if (!Student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ message: 'Server error' });
  }
}
const bulkDeleteController = async (req, res) => {
  const { ids } = req.body;  // array of ids
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids array required' });
  }
  try {
    await student.deleteMany({ _id: { $in: ids } });
    return res.json({ success: true, deletedCount: ids.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error deleting many students' });
  }
}

const assignStudController = async (req, res) => {
  const { studentIds, userId } = req.body;
  if (!studentIds || !userId) {
    return res.status(400).json({ message: 'studentIds and userId required' });
  }

  try {
    const now = new Date();

    for (const stuId of studentIds) {
      const stu = await student.findById(stuId).populate('assignedTo', 'username');;
      if (!stu) {
        console.warn(`Student ${stuId} not found, skipping`);
        continue;
      }

      // If already assigned to someone, mark that assignment's unassignedAt
      if (stu.assignedTo) {
        await Assignment.findOneAndUpdate(
          { student: stu._id, user: stu.assignedTo, unassignedAt: null },
          { $set: { unassignedAt: now } }
        ).exec();
      }
      {/* else {
       {/* console.warn(`Student ${stuId} is not assigned to any user.`);}
      }*/}
      // Create a new assignment history record
      const newAssign = new Assignment({
        student: stu._id,
        user: userId,
        assignedAt: now,
        unassignedAt: null
      });
      await newAssign.save();

      // Update student’s current assignment
      stu.assignedTo = userId;
      stu.assignedAt = now;
      await stu.save();
    }

    return res.json({ message: 'Students assigned (with history) successfully' });
  } catch (err) {
    console.error('Error in assignStudents:', err);
    return res.status(500).json({ message: 'Error assigning students', error: err.message });
  }
}
const leadsOverviewController = async (req, res) => {
  try {
    // total students
    const totalStudents = await student.countDocuments();

    // leads unassigned
    const unassignedLeads = await student.countDocuments({ assignedTo: null });

    // leads assigned
    const assignedLeads = await student.countDocuments({ assignedTo: { $ne: null } });

    res.json({
      success: true,
      data: {
        totalStudents,
        unassignedLeads,
        assignedLeads
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard stats', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
const viewAssignedStudentController = async (req, res) => {
  try {
    // Fetch students that are currently assigned
    const students = await student.find({ assignedTo: { $ne: null } })
      .populate('assignedTo', 'username email')
      .lean();

    // Also fetch all assignment history for those students
    const studentIds = students.map(stu => stu._id);
    const assignments = await Assignment.find({ student: { $in: studentIds } })
      .populate('user', 'username email')
      .sort({ assignedAt: 1 })  // chronological
      .lean();

    // Organize assignments per student
    const assignMap = {};
    for (const a of assignments) {
      const sid = String(a.student);
      if (!assignMap[sid]) assignMap[sid] = [];
      assignMap[sid].push(a);
    }

    // Merge into students
    const result = students.map(stu => {
      stu.assignedTo = stu.assignedTo || null;
      return {
        ...stu,
        assignments: assignMap[String(stu._id)] || []
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('Error in viewAssignedWithHistory:', err);
    return res.status(500).json({ message: 'Error fetching assigned students', error: err.message });
  }
}
const getUsersAssignmentStats = async (req, res) => {
  try {
    const stats = await student.aggregate([
      // Match students that are assigned to a user
      { $match: { assignedTo: { $ne: null } } },

      // Group by user and date (keep actual timestamp)
      {
        $group: {
          _id: {
            assignedTo: "$assignedTo",
            date: {
              $dateToString: {
                format: "%Y-%m-%dT%H:%M:%S",
                date: "$assignedAt",
                timezone: "Asia/Kolkata" // keep local timezone
              }
            }
          },
          count: { $sum: 1 },
          lastAssignedAt: { $max: "$assignedAt" } // for time reference
        }
      },

      // Group again by user to get per-day summary and overall stats
      {
        $group: {
          _id: "$_id.assignedTo",
          totalAssigned: { $sum: "$count" },
          dailySummary: {
            $push: {
              date: "$_id.date",
              count: "$count"
            }
          },
          lastAssigned: { $max: "$lastAssignedAt" }
        }
      },

      // Join with users collection
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: "$userInfo" },

      // Project required fields
      {
        $project: {
          _id: 0,
          userId: "$_id",
          username: "$userInfo.username",
          email: "$userInfo.email",
          totalAssigned: 1,
          lastAssigned: 1,
          dailySummary: 1
        }
      },

      { $sort: { lastAssigned: -1 } }
    ]);

    res.json(stats);
  } catch (err) {
    console.error("Error getting assignment stats:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}
const getAssignedStudentsController = async (req, res) => {
  try {
    const user = req.user;  // from requireSignIn
    // Your decode might have _id or userId, depending on how you signed token
    const userId = user._id || user.userId;

    // Optionally check that user.userType === 'user' (so admin cannot access this)
    if (user.userType && user.userType !== "User") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const students = await student.find({ assignedTo: userId })
      .select('name email phone course place assignedAt callInfo')  // only needed fields
      .sort({ assignedAt: -1 })
      .lean();

    return res.json({ success: true, students });
  } catch (err) {
    console.error("getAssignedStudents error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
const getAssignedStudentsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const students = await student.find({
      assignedAt: { $gte: startOfDay, $lte: endOfDay },
      assignedTo: req.user._id,
    }).select('name assignedAt');

    res.json({ success: true, students });
  } catch (err) {
    console.error("Error fetching assigned students:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
const deleteAssignedStudentsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    await student.deleteMany({
      assignedAt: { $gte: startOfDay, $lte: endOfDay },
      assignedTo: req.user._id,
    });

    res.json({ success: true, message: "Notifications deleted successfully" });
  } catch (err) {
    console.error("Error deleting notifications:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const studentCallStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };

    const stu = await student.findById(id);
    if (!stu) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Disable edits if callInfo has already been verified
    if (stu.callInfo && stu.callInfo.verified === true) {
      return res.status(403).json({
        success: false,
        message: 'Editing disabled: call info has been verified.'
      });
    }

    // 🟡 Handle Switched Off case (reset other fields)
    if (updateData.callStatus === 'Switched Off') {
      updateData.callDuration = null;
      updateData.interested = null;
      updateData.planType = null;
    } else {
      // Convert interested properly
      if (!['Yes', 'No', 'Inform Later'].includes(updateData.interested)) {
        updateData.interested = null;
      }

      // PlanType only if interested === 'Yes'
      updateData.planType =
        updateData.interested === 'Yes' ? updateData.planType || null : null;
    }

    // Handle empty or undefined values
    updateData.callDuration = updateData.callDuration || null;
    updateData.callStatus = updateData.callStatus || null;

    // Mark completedAt when callStatus is present
    updateData.completedAt = updateData.callStatus ? new Date() : null;

    const finalUpdate = { callInfo: updateData };

    const updated = await student.findByIdAndUpdate(
      id,
      { $set: finalUpdate },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Student status updated successfully',
      student: updated,
    });
  } catch (error) {
    console.error('Error updating student status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating student status',
      error: error.message,
    });
  }
}
const studentAssignedSummaryStatus = async (req, res) => {
  try {
    const userId = req.user._id; // from auth middleware

    // Fetch only students assigned to this user
    const Students = await student.find({ assignedTo: userId })
      .sort({ assignedAt: -1 })
      .lean();


    const totalAssigned = Students.length;
    const completed = Students.filter(s => s.callInfo && s.callInfo.callStatus).length;
    const pending = totalAssigned - completed;

    // Total call duration in seconds
    const totalCallDuration = Students.reduce((sum, s) => {
      return sum + (s.callInfo?.callDuration ? s.callInfo.callDuration * 60 : 0);
    }, 0);

    // Total interested count
    const totalInterested = Students.filter(s => s.callInfo?.interested === 'Yes').length;
    const totalNotInterested = Students.filter(s => s.callInfo?.interested === 'No').length;
    const informLaterCount = Students.filter(s => s.callInfo?.interested === 'Inform Later').length;
    const missingInterest = Students.filter(
      s => s.callInfo?.interested == null || s.callInfo?.interested === ''
    ).length;
    // Plan type counts
    const planCounts = Students.reduce((acc, s) => {
      const plan = s.callInfo?.planType?.toLowerCase();
      if (plan && ['starter', 'gold', 'master'].includes(plan)) {
        acc[plan] = (acc[plan] || 0) + 1;
      }
      return acc;
    },
      { starter: 0, gold: 0, master: 0 });

    // Course-wise count
    const courseCounts = Students.reduce((acc, s) => {
      const course = s.course;
      if (course) acc[course] = (acc[course] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      students: Students,
      summary: {
        totalAssigned,
        completed,
        pending,
        totalCallDuration,  // in seconds
        totalInterested,
        totalNotInterested,
        informLaterCount,
        missingInterest,
        planCounts,
        courseCounts
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
const getUserCompletionsController = async (req, res) => {
  try {
    const Users = mongoose.model('users');
    const Students = mongoose.model('students');
    // Fetch users who have completed assignments
    const completedUsers = await Users.find(
      { isAssignmentComplete: true, assignmentCompletedAt: { $ne: null } },
      'username assignmentCompletedAt'
    ).sort({ assignmentCompletedAt: -1 });
    const formattedUsers = await Promise.all(completedUsers.map(async (u) => {
      // Find the earliest assigned student for assigned date
      const firstAssignment = await Students.findOne({ assignedTo: u._id }).sort({ assignedAt: 1 });
      const totalAssigned = await Students.countDocuments({ assignedTo: u._id });

      return {
        _id: u._id,
        username: u.username,
        assignedDate: firstAssignment?.assignedAt || null,
        totalContacts: totalAssigned,
        completedAt: u.assignmentCompletedAt
      };
    }));
    res.json({
      success: true,
      data: formattedUsers,
    });
  } catch (err) {
    console.error('Error fetching user completions:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
const deleteUserCompletionTaskController = async (req, res) => {
  const { userId } = req.params;
  try {
    const Users = mongoose.model('users');
    // Clear the completion flags for that user (so it doesn't show)
    await Users.findByIdAndUpdate(userId, {
      isAssignmentComplete: false,
      assignmentCompletedAt: null,
      // maybe also assignmentGivenAt = null if you want to fully reset
    });
    res.json({ success: true, message: 'Notification dismissed' });
  } catch (err) {
    console.error('Error dismissing completion notification:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
const getAssignedWorkReportController = async (req, res) => {
  try {
    const { assignedTo } = req.query;
    if (!assignedTo) {
      return res.status(400).json({ message: 'assignedTo query param is required' });
    }

    const students = await student.find({ assignedTo })
      .select('assignedTo assignedAt name email phone course place callInfo')
      .populate({
        path: 'assignedTo',
        select: 'username email'
      })
      .lean();

    const callsessions = await CallSession.aggregate([
      { $match: { student: { $in: students.map(s => s._id) } } },
      { $sort: { stoppedAt: -1 } },
      {
        $group: {
          _id: '$student',
          lastDurationSeconds: { $first: '$durationSeconds' }
        }
      }
    ]);

    const sessionMap = callsessions.reduce((acc, cs) => {
      acc[cs._id.toString()] = cs.lastDurationSeconds;
      return acc;
    }, {});

    students.forEach(s => {
      s.callSessionDurationSeconds = sessionMap[s._id.toString()] || 0;  // NEW: attach duration seconds
    });

    const totalCallSession = await CallSession.aggregate([
      { $match: { student: { $in: students.map(s => s._id) } } },
      { $group: { _id: null, totalTimerDurationSeconds: { $sum: '$durationSeconds' } } }
    ]);

    const totalTimerDurationSeconds = totalCallSession[0]?.totalTimerDurationSeconds || 0; // NEW
    const callTypeSummary = {};
    const statusList = ['Missed', 'Accepted', 'Rejected', 'Switched Off'];

    statusList.forEach(st => {
      callTypeSummary[st] = { count: 0, timerDuration: 0, callDuration: 0 };
    });

    students.forEach(s => {
      const ci = s.callInfo || {};
      const status = (ci.callStatus || '').trim();

      if (statusList.includes(status)) {
        callTypeSummary[status].count += 1;
        if (!isNaN(s.callSessionDurationSeconds)) {
          callTypeSummary[status].timerDuration += Number(s.callSessionDurationSeconds);
        }
        if (ci.callDuration && !isNaN(ci.callDuration)) {
          callTypeSummary[status].callDuration += Number(ci.callDuration) * 60; // to seconds
        }
      }
    });

    // Compute summary
    let totalContacts = students.length;
    let totalCallDurationSec = 0; // in seconds
    let countYes = 0;
    let countNo = 0;
    let countInformLater = 0;
    let switchedOffCount = 0;

    students.forEach(s => {
      const ci = s.callInfo || {};
      // callDuration stored in minutes? hours? Depends. Suppose it's in minutes or fraction.
      if (ci.callDuration != null && !isNaN(ci.callDuration)) {
        // convert to seconds
        totalCallDurationSec += Number(ci.callDuration) * 60;
      }
      if (ci.interested === 'Yes') {
        countYes += 1;
      } else if (ci.interested === 'No') {
        countNo += 1;
      } else if (ci.interested === 'Inform Later') {
        countInformLater += 1;
      }
      if ((ci.callStatus || '') === 'Switched Off') {
        switchedOffCount += 1;
      }
    });

    res.json({
      students,
      summary: {
        totalContacts,
        totalCallDurationSec,
        totalTimerDurationSeconds,   // total duration in seconds
        countYes,
        countNo,
        countInformLater,
        switchedOffCount,
        callTypeSummary
      }
    });
  } catch (err) {
    console.error('Error fetching assigned students:', err);
    res.status(500).json({ message: 'Error fetching students', error: err });
  }

}
const getTotalSummaryReportController = async (req, res) => {
  try {
    const agg = await student.aggregate([
      {
        $group: {
          _id: '$assignedTo',
          totalContacts: { $sum: 1 },
          completedCalls: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$callInfo.completedAt', null] },
                    { $eq: ['$callInfo.verified', true] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalDuration: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$callInfo.callDuration', null] },
                    { $isNumber: '$callInfo.callDuration' },
                    { $eq: ['$callInfo.verified', true] }
                  ]
                },
                '$callInfo.callDuration',
                0
              ]
            }
          },
          assignedAt: { $first: '$assignedAt' },
          lastCompletedAt: {
            $max: {
              $cond: [
                { $eq: ['$callInfo.verified', true] },
                '$callInfo.completedAt',
                null
              ]
            }
          }
        }
      },
      {
        $addFields: {
          allCompleted: {
            $cond: [
              {
                $and: [
                  { $eq: ['$completedCalls', '$totalContacts'] },
                  { $ne: ['$lastCompletedAt', null] }
                ]
              },
              true,
              false
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          name: '$user.username',
          email: '$user.email',
          phone: '$user.phone',
          totalContacts: 1,
          completed: {
            $cond: [
              { $eq: ['$allCompleted', true] },
              '$totalContacts',
              0
            ]
          },
          totalDuration: 1,
          assignedAt: {
            $dateToString: { format: "%d-%b-%Y", date: '$assignedAt' }
          },
          completedAt: {
            $cond: [
              { $eq: ['$allCompleted', true] },
              { $dateToString: { format: "%d-%b-%Y", date: '$lastCompletedAt' } },
              null
            ]
          }
        }
      }
    ]);

    res.json(agg);
  } catch (err) {
    console.error('Error generating user summary report', err);
    res.status(500).json({ error: 'Server error' });
  }
}
const addAdmissionController = async (req, res) => {
  const { ids } = req.body;  // array of student IDs
  try {
    const students = await student.find({ _id: { $in: ids } });
    if (!students.length) return res.status(404).json({ message: "No students found" });

    const admissions = students.map(s => ({
      name: s.name,
      email: s.email,
      phone: s.phone,
      course: s.course,
      place: s.place,
      originalStudentId: s._id
    }));
    await Admission.insertMany(admissions);
    await student.deleteMany({ _id: { $in: ids } });

    res.status(200).json({ message: "Moved to Admission" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}
const addContactLaterController = async (req, res) => {
  const { ids } = req.body;
  try {
    const students = await student.find({ _id: { $in: ids } });
    if (!students.length) return res.status(404).json({ message: "No students found" });

    const contacts = students.map(s => ({
      name: s.name,
      email: s.email,
      phone: s.phone,
      course: s.course,
      place: s.place,
      originalStudentId: s._id
    }));
    await ContactLater.insertMany(contacts);
    await student.deleteMany({ _id: { $in: ids } });

    res.status(200).json({ message: "Moved to Contact Later" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}
const callStartController = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'studentId required' });
    }
    const existing = await CallSession.findOne({
      student: studentId,
      user: req.user._id,
      stoppedAt: null
    });
    if (existing) {
      return res.json({
        sessionId: existing._id,
        startedAt: existing.startedAt,
        alreadyActive: true
      });
    }
    // create call session
    const session = new CallSession({
      student: studentId,
      user: req.user._id
    });

    await session.save();

    // respond with session id and startedAt
    return res.json({ sessionId: session._id, startedAt: session.startedAt });
  } catch (err) {
    console.error('Call start error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
const callStopController = async (req, res) => {
  try {
    const { sessionId, callStatus, interested, planType } = req.body;
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const session = await CallSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (session.stoppedAt) {
      // already stopped
      return res.json({ alreadyStopped: true });
    }

    const stoppedAt = new Date();
    const durationSeconds = Math.max(0, Math.round((stoppedAt - session.startedAt) / 1000));

    session.stoppedAt = stoppedAt;
    session.durationSeconds = durationSeconds;
    session.status = 'Stopped';
    await session.save();

    const stu = await student.findById(session.student); // CHANGED to correct model import
    if (stu) {
      stu.callInfo = stu.callInfo || {};

      // NEW: store timer duration in seconds separately
      stu.callInfo.timerDurationSeconds = durationSeconds;

      // KEEP user-entered duration field separate
      // stu.callInfo.callDuration remains whatever user input

      if (callStatus) stu.callInfo.callStatus = callStatus;
      if (interested) stu.callInfo.interested = interested;
      if (planType) stu.callInfo.planType = planType;
      stu.callInfo.completedAt = stoppedAt;

      await stu.save();
    }

    return res.json({
      sessionId: session._id,
      durationSeconds,
      durationMinutes: Math.round((durationSeconds / 60) * 100) / 100,
      stoppedAt,
      student: stu ? stu.toObject() : null
    });
  } catch (err) {
    console.error('Call stop error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
const verifyCallInfoController = async (req, res) => {
  try {
    const { id } = req.params;
    const stu = await student.findById(id);
    if (!stu) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Mark as verified
    stu.callInfo.verified = true;
    await stu.save();

    return res.status(200).json({ success: true, message: 'Call info verified.', student: stu });
  } catch (err) {
    console.error('Error verifying callInfo:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
const bulkverifyCallInfoController = async (req, res) => {
  try {
    const { ids } = req.body;  // expect array of _id strings
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No student IDs provided' });
    }

    const result = await student.updateMany(
      { _id: { $in: ids } },
      { $set: { 'callInfo.verified': true } }
    );

    return res.status(200).json({
      success: true,
      message: `Marked ${result.modifiedCount} students call status as verified.`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error('Error bulk verifying callInfo:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
const weeklyReportController = async (req, res) => {
    try {
    const reports = await WorkReport.find().sort({ week: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
const monthlyReportController = async (req, res) => {
 try {
    const reports = await WorkReport.find().sort({ month: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
const dailyReportController=async(req,res)=>{
  try {
    const reports = await WorkReport.find().sort({ day: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
module.exports = { uploadSheetDetails, viewStudController, editStudController, deleteStudController, bulkDeleteController, assignStudController, leadsOverviewController, viewAssignedStudentController, getUsersAssignmentStats, getAssignedStudentsController, getAssignedStudentsByDate, deleteAssignedStudentsByDate, studentCallStatusController, studentAssignedSummaryStatus, getUserCompletionsController, deleteUserCompletionTaskController, getAssignedWorkReportController, getTotalSummaryReportController, addAdmissionController, addContactLaterController, callStartController, callStopController, verifyCallInfoController, bulkverifyCallInfoController, weeklyReportController, monthlyReportController,dailyReportController };
