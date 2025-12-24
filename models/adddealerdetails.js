import mongoose from "mongoose";

const adddealerdetailsSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null
    },
    logo:{
        type:String,
        defalut:null
    },
    video:{
        type:String,
        default:null
    },
    userType:{
        type: String,
        default: 'Dealer'
    }

},{strict: false,timestamps:true})

export default mongoose.model("Sealler",adddealerdetailsSchema);