const mongoose = require('mongoose');

const callSessionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'students', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true }, // who initiated
  startedAt: { type: Date, default: Date.now },
  stoppedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: null }, // seconds
  status: { type: String, enum: ['Started','Stopped','Abandoned'], default: 'Started' },
}, { timestamps: true });

module.exports = mongoose.model('callsessions', callSessionSchema);