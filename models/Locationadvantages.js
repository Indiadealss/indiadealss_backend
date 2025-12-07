import mongoose from "mongoose"

const LocationadvantagesSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    icon:{
        type:String,
        required:true
    }
},{timestamps:true})


const Locationadvantages = mongoose.model("Locationadvantages",LocationadvantagesSchema)

export default Locationadvantages;