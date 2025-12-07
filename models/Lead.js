import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
    user_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref: "User",
        required:true,
    },
    property_id:{
        type:mongoose.Schema.Types.ObjectId,
        unique:true,
         ref: "Property"
    },
    purpose:{
        type:'string'
    },
    message:{
        type:'string',
    }
},{timestamps:true})

const Lead = mongoose.model("Lead",LeadSchema);

export default Lead;