
const user=require('../controllers/userLogic')
const student=require('../controllers/studentLogic')
const { requireSignIn,isAdmin } = require('../middlewares/authMiddleware')

const express=require('express')
const router=new express.Router()

router.post('/register',user.userRegister)
router.post('/login',user.userLogin)
router.post('/forgot-password',user.forgotPasswordController)
router.post('/reset-password/:id/:token',user.resetPasswordController)
router.get('/test',requireSignIn,isAdmin,user.testController)

//Protected User Route
router.get('/user-auth',requireSignIn,(req,res)=>{
    res.status(200).send({ok:true})
})
router.get('/all-users',requireSignIn,user.userDetails)
router.get('/status',requireSignIn,user.userStatus)
router.get('/my-profile',requireSignIn,user.userProfile)
router.put('/my-profile',requireSignIn,user.editProfile)
router.delete('/delete-user/:id',requireSignIn,user.deleteProfile)

//Protected Admin Route
router.get('/admin-auth',requireSignIn,isAdmin,(req,res)=>{
    res.status(200).send({ok:true})
})
router.put('/verify/:id',requireSignIn, isAdmin,user.verfifyController)
router.get('/admin-status',requireSignIn,isAdmin,user.adminStatus)
router.get('/admin-profile',requireSignIn,isAdmin,user.adminProfile)
router.put('/admin-profile',requireSignIn,isAdmin,user.editAdminProfile)
router.delete('/admin-delete/:id',requireSignIn,isAdmin,user.deleteAdminProfile)


router.post('/admin/upload-sheet',requireSignIn,isAdmin,student.uploadSheetDetails)
router.get('/admin/view-students',requireSignIn,isAdmin,student.viewStudController)




module.exports=router