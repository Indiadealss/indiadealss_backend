import mongoose from "mongoose";
import formDB from "../config/formDb.js";

const formSubmissionSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true
    },
    mobile_no:{
        type:String,
        required:true,
        trim:true
    },
    email:{
        type:String,
        trim:true,
        lowercase:true
    },
    message:{
        type:String
    },
    // Which website / page the form was submitted from
    source:{
        type:String
    },
    // Any extra form fields the other website sends
    extra:{
        type:mongoose.Schema.Types.Mixed,
        default:{}
    },
    ip:{
        type:String
    }
},{timestamps:true});

const FormSubmission = formDB.model("FormSubmission",formSubmissionSchema);

export default FormSubmission;
