// controllers/uploadController.js

const mongoose = require('mongoose');
const User = require('../model/userModel'); 
const student = require('../model/customerModel');
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

const viewStudController=async(req,res)=>{
  try {
    const students = await student.find() // remove __v if you want
    res.json(students); 
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Server error fetching students' });
  }
}

const editStudController=async(req,res)=>{
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

const deleteStudController=async(req,res)=>{
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
const bulkDeleteController=async(req,res)=>{
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

const assignStudController=async(req,res)=>{
  const { studentIds, userId } = req.body;
  if (!studentIds || !userId) {
    return res.status(400).json({ message: 'studentIds and userId required' });
  }

  try {
    await student.updateMany(
      { _id: { $in: studentIds } },
      { $set: { assignedTo: userId , assignedAt: new Date()} }
    );
    res.json({ message: 'Students assigned successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error assigning students', error: err });
  }
}
const leadsOverviewController=async(req,res)=>{
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
const viewAssignedStudentController=async(req,res)=>{
  try {
    // Find students where assignedTo is not null and populate the assigned user
    const assigned = await student.find({ assignedTo: { $ne: null } })
      .populate('assignedTo', 'username email') // bring required user fields
      .sort({ assignedAt: -1 })
      .lean();

    res.json(assigned);
  } catch (err) {
    console.error('Error fetching assigned students', err);
    res.status(500).json({ message: 'Error fetching assigned students', error: err.message });
  }
}
module.exports = { uploadSheetDetails,viewStudController, editStudController,deleteStudController,bulkDeleteController,assignStudController,leadsOverviewController,viewAssignedStudentController };
