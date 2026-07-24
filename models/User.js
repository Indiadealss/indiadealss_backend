import mongoose from "mongoose";

const VERIFICATION_STATUS = ['not_started', 'pending', 'verified'];

const docVerificationSchema = {
  status: { type: String, enum: VERIFICATION_STATUS, default: 'not_started' },
  docType: { type: String, default: '' },
  docUrl: { type: String, default: '' },
  submittedAt: { type: Date },
};

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
      altPhone:{
        type:String,
        default:''
      },
      bio:{
        type:String,
        default:''
      },
      location:{
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
    },
    role:{
      type:String,
      enum:['user','admin'],
      default:'user'
    },
    verification: {
      email: {
        status: { type: String, enum: VERIFICATION_STATUS, default: 'not_started' },
      },
      phone: {
        status: { type: String, enum: VERIFICATION_STATUS, default: 'not_started' },
      },
      identity: docVerificationSchema,
      address: docVerificationSchema,
      business: docVerificationSchema,
    },
    documents: [{
      name: { type: String, default: '' },
      type: { type: String, default: '' },
      status: { type: String, enum: VERIFICATION_STATUS, default: 'pending' },
      fileUrl: { type: String, default: '' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    bankDetails: {
      accountHolder: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      bankName: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      accountType: { type: String, enum: ['saving', 'current'], default: 'saving' },
      branch: { type: String, default: '' },
      chequeUrl: { type: String, default: '' },
      status: { type: String, enum: VERIFICATION_STATUS, default: 'not_started' },
    },
}, { timestamps: true });

export default mongoose.model("User", userSchema);