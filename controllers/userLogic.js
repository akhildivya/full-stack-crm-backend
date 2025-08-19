const User = require('../model/userModel')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
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
            res.status(400).json("User already exists")
        }
        else {
            const hashPad = await bcrypt.hash(password, 10)
            const newUser = new User({ username, email, password: hashPad })
            await newUser.save()
            res.status(200).json(`registered with username ${username}`)
        }

    }
    catch (err) {
        res.status(401).json({ message: "User register API not working" })
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
            res.status(404).json("incorrect username or password")
        }
    }
    catch (err) {
        res.status(401).json("Login Api not working")
    }
}
const testController = async (req, res) => {
    res.status(400).json({ message: "protected route" })
}

const forgotPasswordController = async (req, res) => {
    try {
        
    }
    catch (err) {
        res.status(500).json({ message: "Forgot password api not working" })
    }

}

module.exports = { userRegister, userLogin, testController, forgotPasswordController }