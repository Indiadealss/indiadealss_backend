import mongoose from "mongoose"

const PropertySchema = new mongoose.Schema({
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


const Propertyfeatures = mongoose.model("Propertyfeatures",PropertySchema)

export default Propertyfeatures;