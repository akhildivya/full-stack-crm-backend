const mongoose = require('mongoose')
const callInfoSchema = new mongoose.Schema({
  callStatus: { type: String, enum: ['Missed', 'Accepted', 'Rejected'], default: null },
  callDuration: { type: Number, default: null }, // in minutes
  interested: { type: Boolean, default: null },
  planType: { type: String, enum: ['Starter', 'Gold', 'Master'], default: null },
  completedAt: { type: Date, default: null },  
}, {
  timestamps: true, // separate timestamps for this subdocument
});

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: { unique: true },
        validate: {
            validator: v => /^([\w-.]+@([\w-]+\.)+[\w-]{2,})$/.test(String(v)),
            message: props => `${props.value} is not a valid email`
        }
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        index: { unique: true }
    },
    course: { type: String, required: true, trim: true },
    place: { type: String, required: true, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'users', default: null },
    assignedAt: {
        type: Date,
        default: null
    },
    callInfo: callInfoSchema
    
}, { timestamps: true })
studentSchema.virtual('callMarked').get(function() {
  // we consider “marked” if *any* field in callInfo is non-null (except default)
  if (this.callInfo) {
    if (this.callInfo.callStatus != null
        || this.callInfo.callDuration != null
        || this.callInfo.interested != null
        || this.callInfo.planType != null
        || this.callInfo.completedAt != null) {
      return 'marked';
    }
  }
  return 'not marked';
});

// Make virtuals visible in JSON / object output
studentSchema.set('toObject', { virtuals: true });
studentSchema.set('toJSON', { virtuals: true });

studentSchema.post('save', async function (doc, next) {
  try {
    if (!doc.assignedTo) {
      return next();
    }

    const Students = mongoose.model('students');
    const Users = mongoose.model('users');

    const totalAssigned = await Students.countDocuments({ assignedTo: doc.assignedTo });
    const completedCount = await Students.countDocuments({
      assignedTo: doc.assignedTo,
      'callInfo.completedAt': { $ne: null }
    });

    if (totalAssigned > 0 && totalAssigned === completedCount) {
      await Users.findByIdAndUpdate(doc.assignedTo, {
        isAssignmentComplete: true,
        assignmentCompletedAt: new Date()
      });
      console.log(`User ${doc.assignedTo} has completed all tasks.`);
    } else {
      await Users.findByIdAndUpdate(doc.assignedTo, {
        isAssignmentComplete: false,
        assignmentCompletedAt: null
      });
    }

    next();
  } catch (err) {
    console.error('Error checking assignment completion in post-save:', err);
    next(err);
  }
});

// Optionally, also support findOneAndUpdate, etc.
studentSchema.post('findOneAndUpdate', async function (doc, next) {
  // very similar logic — note `this.getQuery()` or `this.getUpdate()` to locate doc
  try {
    if (!doc) {
      return next();
    }
    if (!doc.assignedTo) {
      return next();
    }

    const Students = mongoose.model('students');
    const Users = mongoose.model('users');

    const totalAssigned = await Students.countDocuments({ assignedTo: doc.assignedTo });
    const completedCount = await Students.countDocuments({
      assignedTo: doc.assignedTo,
      'callInfo.completedAt': { $ne: null }
    });

    if (totalAssigned > 0 && totalAssigned === completedCount) {
      await Users.findByIdAndUpdate(doc.assignedTo, {
        isAssignmentComplete: true,
        assignmentCompletedAt: new Date()
      });
      console.log(`User ${doc.assignedTo} has completed all tasks (via findOneAndUpdate).`);
    } else {
      await Users.findByIdAndUpdate(doc.assignedTo, {
        isAssignmentComplete: false,
        assignmentCompletedAt: null
      });
    }

    next();
  } catch (err) {
    console.error('Error in findOneAndUpdate post hook:', err);
    next(err);
  }
});


const students = mongoose.model('students', studentSchema);

module.exports = students;