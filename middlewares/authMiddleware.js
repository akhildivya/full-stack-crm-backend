const jwt = require('jsonwebtoken')
const User = require('../model/userModel')
const requireSignIn = async (req, res, next) => {
    try {
        const decode = jwt.verify(req.headers.authorization, process.env.JWT_SECRET)
        req.user=decode
        next()
    }
    catch (err) {
       console.log(err);
       
    }
}
const isAdmin=async(req,res,next)=>{
    try
    {
        const user=await User.findById(req.user._id)
        if(user.userType !=='Admin')
        {
            res.status(401).json({message :"Unauthorized access"})
        }
        else
        {
            next()
        }
    }
    catch(err)
    {
        res.status(401).json({message:"error in admin middleware"})
    }
}
module.exports={requireSignIn,isAdmin }