// controllers/followupController.js
const Admission = require('../model/admissionSchema');
const ContactLater = require('../model/contactLaterSchema');
const mongoose = require('mongoose')

async function listFollowup(req, res) {
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
