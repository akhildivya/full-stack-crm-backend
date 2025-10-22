// controllers/followupController.js
const Admission = require('../model/admissionSchema');
const ContactLater = require('../model/contactLaterSchema');

async function listFollowup(req, res) {
  const { mode } = req.params;         // 'admission' or 'contactLater'
  const {
    search = '',
    sortKey = 'movedAt',
    sortDir = 'desc',
    page = 1,
    limit = 10
  } = req.query;

  const Model = mode === 'contactLater' ? ContactLater : Admission;

  const filter = {};
  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { course: regex },
      { place: regex }
    ];
  }

  const sortObj = {};
  sortObj[sortKey] = sortDir === 'asc' ? 1 : -1;

  const skip = (page - 1) * limit;
  try {
    const [total, rows] = await Promise.all([
      Model.countDocuments(filter),
      Model.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
    ]);
    res.json({ total, rows });
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { listFollowup };
