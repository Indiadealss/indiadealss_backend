import mongoose from "mongoose";

const FeatureSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    icon:{
        type:String,
        required:true,
    }
},{timestamps:true});

const Feature = mongoose.model("Feature",FeatureSchema);

export default Feature;