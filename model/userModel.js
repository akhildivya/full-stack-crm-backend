const mongoose = require('mongoose')
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    question:{
        type:String,
        required:true
    },
    role: {
        type: Number,
        default: 0
    }
}, { timestamps: true })
const users = mongoose.model("users", userSchema)
module.exports = users