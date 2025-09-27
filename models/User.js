import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
     type: String,
     },
  email: {
     type: String,
       unique: true,
       sparse:true
      },
  password: {
     type: String,
     },
       mobile: {
     type: String,
      required: true, unique: true 
    },
}, { timestamps: true });

export default mongoose.model("User", userSchema);