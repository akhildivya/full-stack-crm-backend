const mongoose = require('mongoose')
const admissionSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  course: String,
  place: String,
  movedAt: { type: Date, default: Date.now },
  originalStudentId: { type: mongoose.Schema.Types.ObjectId , ref: 'students' }
});
const admissions = mongoose.model('admissions', admissionSchema);
module.exports=admissions
