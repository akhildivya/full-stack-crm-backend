// controllers/uploadController.js

const mongoose = require('mongoose');
const student = require('../model/customerModel');
const Assignment = require('../model/assignmentSchema')
const ALLOWED = ['name', 'email', 'phone', 'course', 'place'];

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
    const students = await student.find() // remove __v if you want
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
    // Aggregation on Student
    const stats = await student.aggregate([
      // only students with an assigned user
      { $match: { assignedTo: { $ne: null } } },
      // group by assignedTo
      {
        $group: {
          _id: "$assignedTo",
          count: { $sum: 1 },
          lastAssigned: { $max: "$assignedAt" }
        }
      },
      // join with users collection to get username, email
      {
        $lookup: {
          from: "users",           // your users collection name
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      // unwind the userInfo array
      { $unwind: "$userInfo" },
      // project desired fields
      {
        $project: {
          userId: "$_id",
          username: "$userInfo.username",
          email: "$userInfo.email",
          count: 1,
          lastAssigned: 1
        }
      },
      // optionally sort by count or lastAssigned
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
      .select('name email phone course place assignedAt')  // only needed fields
      .sort({ assignedAt: -1 });

    return res.json({ success: true, students });
  } catch (err) {
    console.error("getAssignedStudents error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
const getAssignedStudentsByDate=async(req,res)=>{
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

module.exports = { uploadSheetDetails, viewStudController, editStudController, deleteStudController, bulkDeleteController, assignStudController, leadsOverviewController, viewAssignedStudentController, getUsersAssignmentStats, getAssignedStudentsController,getAssignedStudentsByDate,deleteAssignedStudentsByDate };
