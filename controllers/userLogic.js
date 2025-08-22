const User = require('../model/userModel')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');
const userRegister = async (req, res) => {

    try {
        const { username, email, password } = req.body
        if (!username) {
            res.status(400).json({ message: "Name is required" })
        }
        if (!email) {
            res.status(400).json({ message: "email is required" })
        }
        if (!password) {
            res.status(400).json({ message: "password is required" })
        }
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            res.status(409).json("User already exists!")
        }
        else {
            const hashPad = await bcrypt.hash(password, 10)
            const newUser = new User({ username, email, password: hashPad })
            await newUser.save()
            res.status(200).json(`Registered with username ${username}`)
        }

    }
    catch (err) {
        res.status(500).json({ message: "network connectivity issues" })
    }
}


const userLogin = async (req, res) => {

    const { email, password } = req.body
    try {
        const currentUser = await User.findOne({ email })
        if (currentUser && await bcrypt.compare(password, currentUser.password)) {
            const token = jwt.sign({ _id: currentUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
            res.status(200).json({ user: currentUser, token })
        }
        else {
            res.status(401).json("Invalid username or password")
        }
    }
    catch (err) {
        res.status(500).json("network connectivity issues")
    }
}
const testController = async (req, res) => {
    res.status(400).json({ message: "protected route" })
}

const forgotPasswordController = async (req, res) => {
    try {
        const { email } = req.body
        const user = await User.findOne({ email })
        //  console.log(user);

        if (!user) {
            res.status(404).json({ message: "The user does not exist" })
        }
        const secret = process.env.JWT_SECRET + user.password;
        const token = jwt.sign({ id: user._id },  secret, { expiresIn: '1h' })
        const resetURL = `${process.env.CLIENT_URL}/reset-password/${user._id}/${token}`
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASS
            }
        })
        const mailOptions = {
            from: process.env.EMAIL,
            to: user.email,
            subject: 'CRM - password reset request: do not reply to this mail',
            text: `Click here to reset your password: ${resetURL}`
        }
        await transporter.sendMail(mailOptions)
        res.status(200).json({ message: `password reset request send to ${user.email}` })

    }
    catch (err) {
        res.status(500).json({ message: "network connectivity issues" })
    }

}
const resetPasswordController = async (req, res) => {
    const { id, token } = req.params
    const { password } = req.body
    const user = await User.findById(id)
    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired' })
    }
    const secret = process.env.JWT_SECRET + user.password
    try {
        jwt.verify(token, secret)
    }
    catch (err) {
        return res.status(400).json({ message: "Invalid or expired token" })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    user.password = hashedPassword
    await user.save()
    return res.status(200).json({ message: 'Password has been reset' })
}

module.exports = { userRegister, userLogin, testController, forgotPasswordController, resetPasswordController }