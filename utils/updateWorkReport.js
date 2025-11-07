const WorkReport = require('../model/workReportSchema');
const mongoose = require('mongoose');

function getWeekString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  // You might use ISO week logic if required
  const week = Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000)
    + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7);
  return `${year}-W${week}`;
}
function getMonthString(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // Sunday=0 … Saturday=6
  const diff = d.getDate() - day; // go back to Sunday
  return new Date(d.setDate(diff));
}
function endOfWeek(date) {
  const st = startOfWeek(date);
  const end = new Date(st);
  end.setDate(st.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
function startOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

async function updateWorkReport(studentDoc) {
  if (!studentDoc.assignedTo) return;

  const Users = mongoose.model('users');
  const user = await Users.findById(studentDoc.assignedTo);
  if (!user) return;

  const assignedDate = studentDoc.assignedAt || studentDoc.createdAt;
  const dayString = assignedDate.toISOString().split('T')[0]; 
  const week = getWeekString(assignedDate);
  const month = getMonthString(assignedDate);

  // Define ranges
  const weekStart = startOfWeek(assignedDate);
  const weekEnd = endOfWeek(assignedDate);

  // Query students for this user in this week
  const Student = mongoose.model('students');

  const assignedCountWeek = await Student.countDocuments({
    assignedTo: user._id,
    assignedAt: { $gte: weekStart, $lte: weekEnd }
  });

  const completedCountWeek = await Student.countDocuments({
    assignedTo: user._id,
    'callInfo.completedAt': { $ne: null, $gte: weekStart, $lte: weekEnd }
  });

  const agg = await Student.aggregate([
    {
      $match: {
        assignedTo: user._id,
        'callInfo.callDuration': { $ne: null },
        'callInfo.completedAt': { $gte: weekStart, $lte: weekEnd }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $multiply: ['$callInfo.callDuration', 60] } }
      }
    }
  ]);
  const totalSecondsWeek = agg.length > 0 ? agg[0].total : 0;

  // Plans logic: count by planType in this week (INSIDE callInfo)
  const planTypes = ['Starter', 'Gold', 'Master'];
  // Count any plan assigned in the week (could also use completed, if you prefer)
  const totalPlansWeek = await Student.countDocuments({
    assignedTo: user._id,
    'callInfo.planType': { $in: planTypes },
    assignedAt: { $gte: weekStart, $lte: weekEnd }
  });

  // count per plan type (INSIDE callInfo)
  const planCountsWeek = {};
  for (const p of planTypes) {
    planCountsWeek[p] = await Student.countDocuments({
      assignedTo: user._id,
      'callInfo.planType': p,
      assignedAt: { $gte: weekStart, $lte: weekEnd }
    });
  }

 const CallSession = mongoose.model('callsessions');
  const timerAgg = await CallSession.aggregate([
    {
      $match: {
        user: user._id,
        stoppedAt: { $gte: weekStart, $lte: weekEnd },
        durationSeconds: { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        totalTimerSeconds: { $sum: '$durationSeconds' }
      }
    }
  ]);
  const totalTimerSecondsWeek = timerAgg.length > 0 ? timerAgg[0].totalTimerSeconds : 0;

  // Upsert into WorkReport
  const update = {
    username: user.username,
     phone:    user.phone || null, 
    assignedCount: assignedCountWeek,
    completedCount: completedCountWeek,
    totalCallDurationSeconds: totalSecondsWeek,
     totalTimerSeconds: totalTimerSecondsWeek,
    totalPlans: totalPlansWeek,
    planCounts: {
      Starter: planCountsWeek['Starter'] || 0,
      Gold: planCountsWeek['Gold'] || 0,
      Master: planCountsWeek['Master'] || 0
    }
  };

  await WorkReport.findOneAndUpdate(
    { user: user._id, week, month ,day: dayString },
    { $set: update },
    { upsert: true, new: true }
  );
}

module.exports = { updateWorkReport };