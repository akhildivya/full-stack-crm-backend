const WorkReport = require('../model/workReportSchema');
const mongoose = require('mongoose');

function getWeekString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7);
  return `${year}-W${week}`;
}

function getMonthString(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function updateWorkReport(studentDoc) {
  if (!studentDoc.assignedTo) return;

  const Users = mongoose.model('users');
  const user = await Users.findById(studentDoc.assignedTo);
  if (!user) return;

  const assignedDate = studentDoc.assignedAt || studentDoc.createdAt;
  const week = getWeekString(assignedDate);
  const month = getMonthString(assignedDate);

  // Count stats
  const assignedCount = await mongoose.model('students').countDocuments({ assignedTo: user._id });
  const completedCount = await mongoose.model('students').countDocuments({
    assignedTo: user._id,
    'callInfo.completedAt': { $ne: null }
  });

  const totalCallDurationSeconds = await mongoose.model('students').aggregate([
    { $match: { assignedTo: user._id, 'callInfo.callDuration': { $ne: null } } },
    { $group: { _id: null, total: { $sum: { $multiply: ['$callInfo.callDuration', 60] } } } }
  ]);

  const totalSeconds = totalCallDurationSeconds[0]?.total || 0;

  await WorkReport.findOneAndUpdate(
    { user: user._id, week, month },
    {
      $set: {
        username: user.username,
      },
      $inc: {
        assignedCount,
        completedCount,
        totalCallDurationSeconds: totalSeconds
      },
      $addToSet: {
        assignedDates: assignedDate,
        completedDates: studentDoc.callInfo?.completedAt || null
      }
    },
    { upsert: true, new: true }
  );
}

module.exports = { updateWorkReport };
