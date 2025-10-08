const mongoose = require('mongoose')
const callInfoSchema = new mongoose.Schema({
  callStatus: { type: String, enum: ['missed', 'accepted', 'rejected'], default: null },
  callDuration: { type: Number, default: null }, // in minutes
  interested: { type: Boolean, default: null },
  planType: { type: String, enum: ['starter', 'gold', 'master'], default: null },
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

const students = mongoose.model('students', studentSchema);

module.exports = students;