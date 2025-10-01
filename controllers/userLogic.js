const User = require('../model/userModel')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');

const userRegister = async (req, res) => {

    try {
        const { username, email, password, userType, phone } = req.body
        if (!username) {
            res.status(400).json({ message: "Name is required" })
        }
        if (!email) {
            res.status(400).json({ message: "email is required" })
        }
        if (!password) {
            res.status(400).json({ message: "password is required" })
        }
        if (!phone) {
            res.status(400).json({ message: "phone number is required" })
        }
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] })
        if (existingUser) {
            res.status(409).json({ message: "Email or phone already in use!" })
        }
        else {
            const hashPad = await bcrypt.hash(password, 10)
            const newUser = new User({ username, email, password: hashPad, userType, phone })
            await newUser.save()
            res.status(200).json(` ${username} is registered`)
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
            const token = jwt.sign({ _id: currentUser._id }, process.env.JWT_SECRET, { expiresIn: '15d' })
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
        const token = jwt.sign({ id: user._id }, secret, { expiresIn: '1h' })
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

const verfifyController = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { verified: true },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }

}

const userDetails = async (req, res) => {
    try {
        const users = await User.find({ userType: 'User' });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }

}

const userStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ verified: user.verified });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const userProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        return res.json(user);
    } catch (err) {
        return res.status(500).json({ message: 'Server error' });
    }
}

const editProfile = async (req, res) => {
    try {
        const updates = req.body; // e.g., { username, email, phone }
        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
        return res.json(user);
    } catch (err) {
        return res.status(500).json({ message: 'Server error' });
    }
}

const deleteProfile = async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: deletedUser });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error" });
    }
}

const adminProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        return res.json(user);
    } catch (err) {
        return res.status(500).json({ message: 'Server error' });
    }
}

const editAdminProfile = async (req, res) => {
    try {
        const updates = req.body; // e.g., { username, email, phone }
        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
        return res.json(user);
    } catch (err) {
        return res.status(500).json({ message: 'Server error' });
    }
}

const deleteAdminProfile = async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: deletedUser });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server Error" });
    }
}
const adminStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ verified: user.verified });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
const getUsersController=async(req,res)=>{
    try {
    const users = await User.find({ userType: 'User',verified: true  }).select('_id username email').sort({ username: 1, email: 1 });;
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err });
  }
}
const unVerifiedController=async(req,res)=>{
     try {
    const users = await User.find({ verified: false });
    res.json(users);
  } catch (error) {
    res.status(500).send('Error fetching unverified users.');
  }
}
const overviewController=async(req,res)=>{
    try {
    // Base filter: only those with userType = "User"
    const baseFilter = { userType: "User" };

    // Total users (of type "User")
    const totalUsers = await User.countDocuments(baseFilter);

    // Verified users among them
    const verifiedUsers = await User.countDocuments({
      userType: "User",
      verified: true,
    });

    // Pending / unverified users among them
    const pendingUsers = await User.countDocuments({
      userType: "User",
      verified: false,
    });

    // List of new (unverified) users of type "User"
    const newUsers = await User.find({
      userType: "User",
      verified: false,
    })
      .sort({ createdAt: -1 })
      .limit(10).select("username email createdAt");

    return res.json({
      totalUsers,
      verifiedUsers,
      pendingUsers,
      newUsers,
    });
  } catch (err) {
    console.error("Error fetching admin overview:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = { userRegister, userLogin, testController, forgotPasswordController, resetPasswordController, verfifyController, userDetails, userStatus, userProfile, editProfile, deleteProfile,adminProfile,editAdminProfile,deleteAdminProfile, adminStatus,getUsersController,unVerifiedController,overviewController }