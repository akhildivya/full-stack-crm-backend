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
        .populate({
          path: 'originalStudentId',
          select: 'callInfo assignedTo',
          populate: {
            path: 'assignedTo',
            select: 'username'
          }
        })
    ]);
   
    res.json({
      total,
      rows: rows.map(r => {
        const orig = r.originalStudentId;
        return {
          ...r.toObject(),
          planType: orig?.callInfo?.planType || 'N/A',
          assigneeName: orig?.assignedTo?.username || 'N/A'
        };
      })
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}



async function deleteFollowup(req, res) {
  const { mode, id } = req.params; // mode = 'admission' or 'contactLater'
  const Model = mode === 'contactLater' ? ContactLater : Admission;

  try {
    const doc = await Model.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({ message: 'Record not found' });
    }
    return res.json({ message: 'Deleted successfully', id });
  } catch (err) {
    console.error('Error deleting follow-up', err);
    return res.status(500).json({ message: 'Server error' });
  }
}
module.exports = { listFollowup, deleteFollowup };
