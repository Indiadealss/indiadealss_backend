import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: undefined,   // ✅ IMPORTANT
    sparse: true          // ✅ IMPORTANT
  },
  Name: {
    type: String,
  },
  PhoneNumber: {
    type: String,
  },
  leadIdentity:{
    type: String,
  },
  projectname: {
    type: String,
  },
  property_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true
  },
  purpose: {
    type: String
  },
  message: {
    type: String,
  },
  spid: {
    type: String,
    sparse: true
  },
  npxid: {
    type: String,
    sparse: true
  }
}, { timestamps: true });

const Lead = mongoose.model("Lead", LeadSchema);
export default Lead;
