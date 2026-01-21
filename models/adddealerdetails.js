import mongoose from "mongoose";

const adddealerdetailsSchema = new mongoose.Schema({
    user_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    property_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Property",
    },
    rera:{
        type:String,
        default:'',
    },
    logo:{
        type:String,
        required:true
    },
    video:{
        type:String,
        default:null
    },
    npxid:{
        type:String,
        required:true
    },
    userType:{
        type: String,
        default: 'dealer'
    }

},{strict: false,timestamps:true});

adddealerdetailsSchema.index(
    {user_id:1,property_id:1},
    {unique: true}
)

export default mongoose.model("Campain",adddealerdetailsSchema);