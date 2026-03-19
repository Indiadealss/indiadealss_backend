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
      phone:{
        type:String,
        default:''
      },
      company_name:{
        type:String,
        default:''
      },
      company_url:{
        type:String,
        default:''
      },
      company_profile:{
        type:String,
        default:''
      },
      address:{
        type:String,
        default:''
      },
      landline:{
        type:String,
        default:''
      },
  password: {
     type: String,
     },
       mobile: {
     type: String,
      required: true, unique: true 
    },
    you_are:{
      type:String,
      default:''
    },
    logo:{
      type:String,
      default:''
    },
    profile:{
      type:String,
      default:''
    }
}, { timestamps: true });

export default mongoose.model("User", userSchema);