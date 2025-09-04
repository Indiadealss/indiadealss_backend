import twilio from "twilio";

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

export const sendOtpSms = async (mobile, otp) => {
  try {
    await client.messages.create({
     body: `Your OTP is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: mobile,
    });
    console.log("📩 OTP Sent to:", mobile);
  } catch (err) {
    console.error("❌ SMS error:", err.message);
  }
};