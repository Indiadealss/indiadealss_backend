import mongoose from "mongoose"

const AmenitiesSchema = new mongoose.Schema({
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


const Amenities = mongoose.model("Amenities",AmenitiesSchema)

export default Amenities;