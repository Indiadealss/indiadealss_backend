import mongoose from "mongoose";
import formDB from "../config/formDb.js";

// Uploaded document stored in S3
const documentSchema = new mongoose.Schema({
    url:{ type:String },
    key:{ type:String },
    originalName:{ type:String },
    mimeType:{ type:String },
    size:{ type:Number }
},{ _id:false });

// Plot booking application coming from the plot booking micro-site
const plotApplicationSchema = new mongoose.Schema({
    applicationId:{ type:String, required:true, unique:true },
    plot:{ type:String, required:true },          // e.g. "110 gaj"
    bookingAmount:{ type:Number, required:true }, // rupees
    name:{ type:String, required:true, trim:true },
    fatherName:{ type:String, required:true, trim:true },
    phone:{ type:String, required:true, trim:true },
    email:{ type:String, required:true, trim:true, lowercase:true },
    aadhaar:{ type:String, required:true, trim:true },
    pan:{ type:String, trim:true, uppercase:true },
    address:{ type:String, required:true },
    city:{ type:String, required:true, trim:true },
    pincode:{ type:String, required:true, trim:true },
    documents:{
        aadhaarCard:{ type:documentSchema },
        panCard:{ type:documentSchema },
        photo:{ type:documentSchema }
    },
    orderId:{ type:String },                      // Razorpay order_...
    receipt:{ type:String },                      // receipt sent while creating the Razorpay order
    status:{ type:String, enum:['pending','paid'], default:'pending' },
    paymentId:{ type:String },                    // Razorpay pay_...
    paidAt:{ type:Date },
    source:{ type:String },
    ip:{ type:String },
    sheetSynced:{ type:Boolean, default:false }
},{timestamps:true});

const PlotApplication = formDB.model("PlotApplication",plotApplicationSchema);

export default PlotApplication;
