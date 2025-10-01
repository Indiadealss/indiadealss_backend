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

// const heighlightSchema = new mongoose.Schema({
//     name:{
//         type:String,
//         require:true
//     }
// })
const imagesSchema = new mongoose.Schema({
    src:{
        type:String,
        unique:false,
        require:true
    }
})

const PropertySchema = new mongoose.Schema({
 
    location:{
        type:Object,
        required:true
    },
    images:{
        type:[imagesSchema],
        required:false,
    },
    owners_type:{
      type:String
    },
   owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
},{strict: false,timestamps:true})

export default mongoose.model("Property", PropertySchema);