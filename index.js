require('dotenv').config()
require('./database/connection')
const router=require('./routes/authRoutes')

const express=require('express')
const cors=require('cors')
const server=express()
const PORT=4001 || process.env.PORT


server.use(cors())
server.use(express.json())
server.use(router)

server.listen(PORT,()=>{
    console.log("....server started at port number ...."+ PORT+"  ");
    
})

