const mongoose = require('mongoose');
const WorkReport = require('../model/workReportSchema');

function getWeekString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = Math.ceil(
    (((d - new Date(d.getFullYear(), 0, 1)) / 86400000)
     + new Date(d.getFullYear(), 0, 1).getDay()
     + 1) / 7
  );
  return `${year}-W${week}`;
}

function getMonthString(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekRange(date) {
  const d   = new Date(date);
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diffToMonday));
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23,59,59,999);
  return { start, end };
}

async function updateWorkReport(studentDoc) {
  if (!studentDoc.assignedTo) return;

  const Users    = mongoose.model('users');
  const Students = mongoose.model('students');
  const user     = await Users.findById(studentDoc.assignedTo);
  if (!user) return;

  const assignedDate = studentDoc.assignedAt || studentDoc.createdAt;
  const week = getWeekString(assignedDate);
  const month = getMonthString(assignedDate);

  const { start: weekStart, end: weekEnd } = getWeekRange(assignedDate);

  const assignedStudents = await Students.find({
    assignedTo: user._id,
    assignedAt: { $gte: weekStart, $lte: weekEnd },
  });

  // Actual counts
  const assignedCountTotal = assignedStudents.length;

  const completedStudents = assignedStudents.filter(
    s => s.callInfo?.completedAt
  );
  const completedCountTotal  = completedStudents.length;

  const totalCallDurationSeconds = assignedStudents.reduce(
    (sum, s) => sum + ((s.callInfo?.callDuration || 0) * 60),
    0
  );

  const planCounts = { Starter: 0, Gold: 0, Master: 0 };
  assignedStudents.forEach(s => {
    const plan = s.callInfo?.planType;
    if (plan && planCounts.hasOwnProperty(plan)) planCounts[plan]++;
  });
  const totalPlans = planCounts.Starter + planCounts.Gold + planCounts.Master;

  await WorkReport.findOneAndUpdate(
    { user: user._id, week, month },
    {
      $set: {
        username: user.username,
        totalPlans,
        planCounts,
        assignedCount: assignedCountTotal,      // store number only
        completedCount: completedCountTotal,    // number only
        totalCallDurationSeconds,
      },
      $addToSet: {
        assignedDates: assignedDate,
        completedDates: studentDoc.callInfo?.completedAt || null,
      },
    },
    { upsert: true, new: true }
  );
}

module.exports = { updateWorkReport };
