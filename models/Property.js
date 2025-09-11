import mongoose from "mongoose";
//const mongoose = require("mongoose");

// const PropertySchema = new mongoose.Schema(
//   {
//     title: { type: String, required: true },
//     description: String,
//     price: Number,
//     address: String,
//     images: [String],
//     createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//   },
//   { timestamps: true }
// );

const heighlightSchema = new mongoose.Schema({
    name:{
        type:String,
        require:true
    }
})
const imagesSchema = new mongoose.Schema({
    src:{
        type:String,
        unique:true,
        require:true
    }
})

const PropertySchema = new mongoose.Schema({
    images:{
        type:[imagesSchema],
        required:true,
        default:'not provided'
    },
    title:{
        type:String,
        required:true,
        trim:true
    },
    description:{
        type:String,
        required:true,
    },
    purpose:{
        type:String,
        required:true,
    },
    propertyType:{
        type:String,
        required:true
    },
    location:{
        type:String,
        required:true
    },
    status:{
        type:String,
        required:true
    },
    bathroom:{
        type:Number,
        required:true
    },
    bedrooms:{
        type:Number,
        required:true
    },
    otherrooms:{
        type:String,
        required:true
    },
    furnishing:{
        type:String,
        required:true
    },
    balconies:{
        type:Number,
        default:0
    },
    floor:{
        type:Number,
        default:0
    },
    price:{
        type:Number,
        required:true
    },
    deposit:{
        type:Number,
        required:true
    },
    size:{
        type:Number,
        required:true
    },
    area:{
        type:String,
        required:true
    },
    amenties:{
        type:String,
        required:true
    },
    heighlights:{
        type:[heighlightSchema],
        default:[]
    },
    coveredparking:{
        type:Number,
        default:0
    },
    uncoverdedparking:{
        type:Number,
        default:0
    },
    owners_type:{
      type:String
    },
   owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
},{timestamps:true})

export default mongoose.model("Property", PropertySchema);