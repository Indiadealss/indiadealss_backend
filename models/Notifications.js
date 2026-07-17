import mongoose from "mongoose";

const notificationsSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    id:{
        type: mongoose.Schema.Types.ObjectId,
        refPath:"model",
        required:true
    },
    model:{
        type: String,
        required:true,
        enum: ["Lead","Property"]
    },
    status:{
        type: String,
        required: true
    }
});

const notificationsMaping = mongoose.model("notificationsMapings", notificationsSchema)

export default notificationsMaping;