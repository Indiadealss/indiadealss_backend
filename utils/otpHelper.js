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
   const message = `OTP for login to crm is ${otp} . Do not share it with anyone. BDDGTL`;

    const url = "http://nimbusit.biz/api/SmsApi/SendSingleApi"
    const params = {
      UserID: "Deepubiz",
      Password: "ynny9542YN",
      SenderID: "BDDSPL",
      Phno: mobile,
      Msg: message,
      EntityID:"1701169804142775424",
      TemplateID:"1707169944518915650"
    };

    const response = await axios.get(url, {params})
    console.log("SMS API Response:", response.data,otpStore);
    
    return otp
    
  } catch (err) {
    console.error("Error while sending sms:", err.message);
    throw new Error("Falled to send otp: " + err.message)
  }
};