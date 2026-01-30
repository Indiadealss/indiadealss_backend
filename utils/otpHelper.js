import AWS from "aws-sdk";
import axios from "axios";

//configure AWS SNS
AWS.config.update({
  region: "ap-south-1", // change to your region
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const sns = new AWS.SNS({apiVersion:"2010-03-31"});

// In-memory store (for testing,use Redis/DB in prod)
export const otpStore = {};

export const sendOtpSms = async (mobile) => {
  
    
    if(!mobile) {
      throw new Error("Mobile Number is Required");
      
    }

    const otp = Math.floor(1000 + Math.random() * 9000);
    otpStore[mobile] = otp;
try {
   const message = `OTP for login into INDIADEALSS is ${otp}. Do not share it with anyone.`;

    const url = "http://nimbusit.biz/api/SmsApi/SendSingleApi"
    const params = {
      UserID: "DSIbiz",
      Password: "Gi5u?R?b",
      SenderID: "lNDEAL",
      Phno: mobile,
      Msg: message,
      EntityID:"1701176562792196286",
      TemplateID:"1707176578841640423"
    };

    const response = await axios.get(url, {params})
    console.log("SMS API Response:", response.data,otpStore);
    
    return otp
    
  } catch (err) {
    console.error("Error while sending sms:", err.message);
    throw new Error("Falled to send otp: " + err.message)
  }
};

export const sendmessage = async (lead,property,propertyOwner) => {
  
    
    
try {
   const message = `Hi, there is an enquiry to buy property in ${property.projectname}. Here are the buyer contact details: ${lead.Name} +91-${lead.PhoneNumber}. Team INDIADEALSS.`;

    const url = "http://nimbusit.biz/api/SmsApi/SendSingleApi"
    const params = {
      UserID: "DSIbiz",
      Password: "Gi5u?R?b",
      SenderID: "lNDEAL",
      Phno: propertyOwner.mobile,
      Msg: message,
      EntityID:"1701176562792196286",
      TemplateID:"1707176578848717220"
    };

    const response = await axios.get(url, {params})
    
    return response
    
  } catch (err) {
    console.error("Error while sending sms:", err.message);
    throw new Error("Falled to send otp: " + err.message)
  }
};