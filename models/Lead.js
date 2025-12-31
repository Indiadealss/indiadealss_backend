import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
    user_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref: "User",
        required:true,
    },
    property_id:{
        type:mongoose.Schema.Types.ObjectId,
         ref: "Property"
    },
    purpose:{
        type:'string'
    },
    message:{
        type:'string',
    }
},{timestamps:true});

LeadSchema.index(
    {user_id: 1,property_id:1},
    {unique: true}
)

const Lead = mongoose.model("Lead",LeadSchema);

export default Lead;