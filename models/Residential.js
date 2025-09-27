import Property from "./Property";
import mongoose from "mongoose";

const residentialSchema  = new mongoose.Schema({
    bedroom: Number,
    bathroom: Number,
    balconies:Number,
    carpetarea:String,
    buildarea:String,
    area:String,
    totalfloor:String,
    propertyfloor:String,
    availbility:String,
    carpetarea:{
        type:String,
        required:true
    },
    location:{
        type:String,
        required:true
    },
    Ownership:{
     type: mongoose.Schema.Types.ObjectId,
     ref: 'User'
    }
});


export default Property.discriminator("residential",residentialSchema );


