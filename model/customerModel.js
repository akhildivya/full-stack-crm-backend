const mongoose = require('mongoose')
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
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

const students = mongoose.model('students', studentSchema);

module.exports = students;