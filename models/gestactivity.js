import mongoose from "mongoose";

const gestactivitySchema = new mongoose.Schema({
    guestId:{
        type: String,
        index:true
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    activityType: {
        type: String,
        enum: ["view","search","filter","click"],
        required:true,
    },
    propertyId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
    },
    meta: {
        type: Object, //search query filters, etc.
    },
    createdAt: {
        type: Date,
        default:Date.now,
        expires: "30d"
    }
});

export default mongoose.model("GuestActivity",gestactivitySchema);