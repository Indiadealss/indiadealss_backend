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
        defalut:'https://cdn.indiadealss.com/indiadealss/indiadealss/1766744904714-real_estate-removebg-preview.png'
    },
    video:{
        type:String,
        default:null
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