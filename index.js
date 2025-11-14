require('dotenv').config()
require('./database/connection')
const router=require('./routes/authRoutes')

const express=require('express')
const cors=require('cors')
const server=express()
const PORT=4000 || process.env.PORT


const corsOptions = {
  origin: 'https://sunny-caramel-d28ec6.netlify.app',  // allow only this frontend
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],     // allowed methods
  allowedHeaders: ['Content-Type','Authorization'],     // allowed headers
  credentials: true                                      // if you are sending cookies/auth headers
};

server.use(cors(corsOptions))
server.use(express.json({ limit: '10mb' }))
server.use(router)

server.listen(PORT,()=>{
    console.log("....server started at port number ...."+ PORT+"  ");
    
})

