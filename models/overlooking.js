import mongoose from "mongoose"

const overlookingSchema = new mongoose.Schema({
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


const overlooking = mongoose.model("overlooking",overlookingSchema)

export default overlooking;