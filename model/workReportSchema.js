const mongoose = require('mongoose');

const workReportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  username: { type: String, required: true },
  phone:    { type: String, default: null }, 
  week: { type: String, required: true }, // e.g. "2025-W45"
  month: { type: String, required: true }, // e.g. "2025-11"

  assignedCount: { type: Number, default: 0 },
  completedCount: { type: Number, default: 0 },
  totalCallDurationSeconds: { type: Number, default: 0 },
  totalTimerSeconds: { type: Number, default: 0 },


  assignedDates: [{ type: Date }],
  completedDates: [{ type: Date }],
  totalPlans: { type: Number, default: 0 },
  planCounts: {
    Starter: { type: Number, default: 0 },
    Gold: { type: Number, default: 0 },
    Master: { type: Number, default: 0 }
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WorkReport', workReportSchema);