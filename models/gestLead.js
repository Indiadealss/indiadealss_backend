import mongoose from "mongoose";

const gestLeadSchema = new mongoose.Schema({
    user_name:{
        type:String,
        required:true,
    },
    mobile_no:{
        type:String,
        required:true
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

gestLeadSchema.index(
    {user_id:1,property_id:1},
    {unique:true}
)

const gestLead = mongoose.model("gestLead",gestLeadSchema);

export default gestLead;