
const user=require('../controllers/userLogic')
const { requireSignIn,isAdmin } = require('../middlewares/authMiddleware')

const express=require('express')
const router=new express.Router()

router.post('/register',user.userRegister)
router.post('/login',user.userLogin)
router.post('/forgot-password',user.forgotPasswordController)
router.post('/reset-password/:id/:token',user.resetPasswordController)
router.get('/test',requireSignIn,isAdmin,user.testController)

//protected Routes
router.get('/user-auth',requireSignIn,(req,res)=>{
    res.status(200).send({ok:true})
})
module.exports=router