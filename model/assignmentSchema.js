const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'students', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  assignedAt: { type: Date, default: () => new Date() },
  unassignedAt: { type: Date, default: null }
}, { timestamps: true });

const Assignment = mongoose.model('assignments', assignmentSchema);
module.exports = Assignment;