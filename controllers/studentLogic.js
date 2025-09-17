const student = require('../model/customerModel')
const ALLOWED = ['name', 'email', 'phone', 'course', 'place'];


const uploadSheetDetails = async (req, res) => {
    function isEmail(v) {
        if (!v) return false;
        return /^([\w-.]+@([\w-]+\.)+[\w-]{2,})$/.test(String(v).toLowerCase());
    }
    try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: 'no_data', message: 'Data array is empty or missing' });
        }
        // check columns in first record
        const first = data[0];
        const keys = Object.keys(first).map(k => k.toLowerCase().trim());
        const extra = keys.filter(k => k && !ALLOWED.includes(k));
        const missing = ALLOWED.filter(k => !keys.includes(k));

        if (extra.length > 0 || missing.length > 0) {
            return res.status(400).json({ error: 'columns_mismatch', extra, missing, expected: ALLOWED });
        }

        const bulkOps = [];
        const invalidRows = [];

        data.forEach((row, idx) => {
            // normalize fields
            const rec = {};
            ALLOWED.forEach(field => {
                rec[field] = row[field] !== undefined && row[field] !== null ? String(row[field]).trim() : '';
            });

            // validate
            const rowErrors = [];
            if (!rec.name) rowErrors.push('name missing');
            if (!rec.email) rowErrors.push('email missing');
            else if (!isEmail(rec.email)) rowErrors.push('email invalid');
            if (!rec.phone) rowErrors.push('phone missing');
            if (!rec.course) rowErrors.push('course missing');
            if (!rec.place) rowErrors.push('place missing');

            if (rowErrors.length > 0) {
                invalidRows.push({ rowIndex: idx, errors: rowErrors, rec });
                return;
            }

            // filter by unique keys: prefer email match, else phone
            const filter = { email: rec.email };
            // you may decide to require both unique constraints
            const update = { $set: rec };

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

        // bulkResult fields depend on version; Mongoose wraps results somewhat
        const insertedCount = bulkResult.upsertedCount || 0;
        const modifiedCount = bulkResult.modifiedCount || 0;

        return res.json({
            insertedCount,
            modifiedCount,
            invalidCount: invalidRows.length,
            invalidRows
        });

    } catch (err) {
        console.error('Upload error:', err);
        // duplicate key / index errors may show up
        if (err.code === 11000) {
            return res.status(409).json({ error: 'duplicate_key', message: err.message });
        }
        return res.status(500).json({ error: 'server_error', message: err.message });
    }
}

module.exports = { uploadSheetDetails }