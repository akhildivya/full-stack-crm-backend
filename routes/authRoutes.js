
const user=require('../controllers/userLogic')
const student=require('../controllers/studentLogic')
const { requireSignIn,isAdmin } = require('../middlewares/authMiddleware')
const {listFollowup} =require('../controllers/followupController')
const {deleteFollowup}=require('../controllers/followupController')

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
router.get('/assigned-contact-details',requireSignIn,student.getAssignedStudentsController)
router.get('/assigned-students/:date',requireSignIn,student.getAssignedStudentsByDate)
router.delete('/assigned-students/:date', requireSignIn, student.deleteAssignedStudentsByDate);
router.put('/students/:id/status',requireSignIn,student.studentCallStatusController)

router.get('/assigned-summary',requireSignIn,student.studentAssignedSummaryStatus)

router.post('/start',requireSignIn,student.callStartController)
router.post('/stop',requireSignIn, student.callStopController)

//Protected Admin Route
router.get('/admin-auth',requireSignIn,isAdmin,(req,res)=>{
    res.status(200).send({ok:true})
})
router.put('/verify/:id',requireSignIn, isAdmin,user.verfifyController)
router.get('/admin-status',requireSignIn,isAdmin,user.adminStatus)
router.get('/admin-profile',requireSignIn,isAdmin,user.adminProfile)
router.put('/admin-profile',requireSignIn,isAdmin,user.editAdminProfile)
router.delete('/admin-delete/:id',requireSignIn,isAdmin,user.deleteAdminProfile)
router.delete('/admin-delete-user/:id',requireSignIn,isAdmin,user.adminDeleteUserController)

router.post('/admin/upload-sheet',requireSignIn,isAdmin,student.uploadSheetDetails)
router.get('/admin/view-students',requireSignIn,isAdmin,student.viewStudController)
router.put('/admin/update-student/:id',requireSignIn,isAdmin,student.editStudController)
router.delete('/admin/delete-student/:id',requireSignIn,isAdmin,student.deleteStudController)
router.delete('/admin/bulk-delete-students',requireSignIn,isAdmin,student.bulkDeleteController)
router.get('/admin/get-users',requireSignIn,isAdmin,user.getUsersController)
router.put('/admin/assign-students',requireSignIn,isAdmin,student.assignStudController)
router.get('/admin/view-assigned-students',requireSignIn,isAdmin,student.viewAssignedStudentController)

router.get('/admin/unverified',requireSignIn,isAdmin,user.unVerifiedController)
router.get('/admin/user-overview',requireSignIn,isAdmin,user.overviewController)
router.get('/admin/leads-overview',requireSignIn,isAdmin,student.leadsOverviewController)
router.get('/admin/users-assignment-stats', requireSignIn,isAdmin,student.getUsersAssignmentStats);
router.get('/admin/user-completions', requireSignIn,isAdmin,student.getUserCompletionsController)
router.delete('/admin/user-completion/:userId',requireSignIn,isAdmin,student.deleteUserCompletionTaskController)
router.get('/admin/get-work-report',requireSignIn,isAdmin,student.getAssignedWorkReportController)
router.get('/admin/users-summary-report',requireSignIn,isAdmin,student.getTotalSummaryReportController)
router.post('/admin/move-to-admission', requireSignIn,isAdmin,student.addAdmissionController)
router.post('/admin/move-to-contact-later',requireSignIn,isAdmin,student.addContactLaterController)
router.put('/admin/students-call/:id/verify',requireSignIn,isAdmin,student.verifyCallInfoController)
router.put('/admin/students-call/bulk-verify',requireSignIn,isAdmin,student.bulkverifyCallInfoController)
router.get('/admin/followup/:mode', requireSignIn, isAdmin, listFollowup);
router.delete('/admin/followup/:mode/:id', requireSignIn, isAdmin, deleteFollowup);



module.exports=router