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
    phone:{
        type:Number,
        required:true
    },
    userType: {
        type: String,
        required:true
    }
}, { timestamps: true })
const users = mongoose.model("users", userSchema)
module.exports = users