const mongoose = require('mongoose')
const contactLaterSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  course: String,
  place: String,
  movedAt: { type: Date, default: Date.now },
  originalStudentId: { type: mongoose.Schema.Types.ObjectId , ref: 'students'}
});
const ContactLater = mongoose.model('contactlaters', contactLaterSchema);
module.exports=ContactLater