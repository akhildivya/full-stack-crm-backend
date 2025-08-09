const mongoose=require('mongoose')
mongoose.connect(process.env.DATABASE).then(()=>{
    console.log("MongoDB atlas connected");
}).catch(err=>{
    console.log(`MongoDB atlas not connected ${err}`);
    
})