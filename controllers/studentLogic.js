// controllers/uploadController.js (or wherever)
const student = require('../model/customerModel');
const ALLOWED = ['name', 'email', 'phone', 'course', 'place'];

const uploadSheetDetails = async (req, res) => {
  function isValidName(name) {
    return /^[A-Za-z\s'-]{2,50}$/.test(name);
  }
  function isEmail(v) {
    if (!v) return false;
    return /^([\w-.]+@([\w-]+\.)+[\w-]{2,})$/.test(String(v).toLowerCase());
  }
  function isValidPhone(phone) {
    return /^\d{10}$/.test(phone);
  }
  function isValidCourse(course) {
    return /^[A-Za-z\s]{2,100}$/.test(course);
  }
  function isValidPlace(place) {
    return /^[A-Za-z\s]{2,100}$/.test(place);
  }

  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'no_data', message: 'Data array is empty or missing' });
    }

    // Normalize keys of the first record and test presence of required fields
    const first = data[0] || {};
    const firstKeys = Object.keys(first).map(k => String(k).toLowerCase().trim());

    // Important change: do NOT fail on extra metadata keys.
    // Only error when required columns are missing.
    const missing = ALLOWED.filter(k => !firstKeys.includes(k));
    if (missing.length > 0) {
      return res.status(400).json({ error: 'columns_mismatch', missing, expected: ALLOWED });
    }

    // proceed to validate rows and build bulk operations
    const bulkOps = [];
    const invalidRows = [];

    data.forEach((row, idx) => {
      // create lowercased key map
      const lowerRow = {};
      Object.keys(row || {}).forEach(k => {
        lowerRow[String(k).toLowerCase().trim()] = row[k];
      });

      // map to canonical fields only
      const rec = {};
      ALLOWED.forEach(field => {
        const val = lowerRow[field] !== undefined && lowerRow[field] !== null
          ? String(lowerRow[field]).trim()
          : '';
        rec[field] = val;
      });

      // validate per-row
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

      // prepare bulk updateOne/upsert
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
        invalidRows
      });
    }

    const bulkResult = await student.bulkWrite(bulkOps, { ordered: false });

    // extract counts safely — differ by driver/versions
    const insertedCount = bulkResult.upsertedCount || bulkResult.insertedCount || 0;
    const modifiedCount = bulkResult.modifiedCount || bulkResult.nModified || 0;

    return res.json({
      insertedCount,
      modifiedCount,
      invalidCount: invalidRows.length,
      invalidRows
    });

  } catch (err) {
    console.error('Upload error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'duplicate_key', message: err.message });
    }
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};

module.exports = { uploadSheetDetails };
