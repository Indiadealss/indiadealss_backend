import mongoose from "mongoose"

const pictureSchema = new mongoose.Schema({
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


const picture = mongoose.model("pictures",pictureSchema)

export default picture;