
const user=require('../controllers/userLogic')
const { requireSignIn,isAdmin } = require('../middlewares/authMiddleware')

const express=require('express')
const router=new express.Router()
router.post('/register',user.userRegister)
router.post('/login',user.userLogin)
router.get('/test',requireSignIn,isAdmin,user.testController)
module.exports=router