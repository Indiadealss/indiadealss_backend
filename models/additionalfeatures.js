import mongoose from "mongoose"

const additionalSchema = new mongoose.Schema({
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


const additionalfeatures = mongoose.model("additionalfeatures",additionalSchema)

export default additionalfeatures;