import mongoose from "mongoose"

const OtheroomSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    label:{
        type:String,
        required:true,
    },
    icon:{
        type:String,
        required:true
    }
},{timestamps:true})


const otheroom = mongoose.model("otheroom",OtheroomSchema)

export default otheroom;