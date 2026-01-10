import mongoose from "mongoose"

const upcomingprojectSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    label:{
        type:String,
        required:true,
    },
    banner:{
        type:String,
        required:true
    },
    projecturl:{
        type:String
    }
},{timestamps:true})


const upcomingproject = mongoose.model("upcomingproject",upcomingprojectSchema)

export default upcomingproject;