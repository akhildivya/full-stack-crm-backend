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
    try {
        const { email, password } = req.body
        if (!email || !password) {
            res.status(400).json({ message: "invalid email or password" })
        }
        const currentUser = await User.findOne({ email })
        if (!currentUser) {
            res.status(404).json({ message: "Email is not registered" })
        }
        const match = await bcrypt.compare(password, currentUser.password)
        if (!match) {
            res.status(400).json({ message: "Invalid password" })
        }
        const token = await jwt.sign({ _id: currentUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
        res.status(200).json({message:"Login successful", user: currentUser, token })
    }
    catch (err) {
        res.status(401).json({ message: "User login API not working" })
    }

}
const testController=async(req,res)=>{
res.status(400).json({message:"protected route"})
}

module.exports = { userRegister, userLogin,testController }