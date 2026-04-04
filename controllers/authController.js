import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { otpStore } from "../utils/otpHelper.js";


import { sendOtpSms } from "../utils/otpHelper.js";

const createToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email,mobile:user.mobile }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const createLoginToken = (userId) => {
  return jwt.sign({user_id:userId}, process.env.JWT_SECRET, { expiresIn: "1d" })
}

export const registerUser = async (req, res) => {
  try {
    const { name, email,mobile } = req.body;
    const exists = await User.findOne({ mobile });
    if (exists) return res.status(400).json({ error: "Mobile Number already exists" });
    const user = await User.create({ name, email,mobile});
    const token = createToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    });

    console.log(token,'ok');
    
    res.json({ message: "User registered successfully", user: { id: user._id, name: user.name, email: user.email,mobile:user.mobile,token } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    const token = createToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    });

	res.status(200).json({ message: "Login successful", token });
//    res.json({ message: "Login successful" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getMe = async (req, res) => {
  try{
    const token = req.cookies.token;
    if(!token) return res.status(401).json({message:"Not authenticated"});

    const user = jwt.verify(token,process.env.JWT_SECRET);
    if(!user) return res.status(401).json({message:"Invalid token"});

    
    const usedetails = await User.findById(user.user_id).select("-password");
    if(!usedetails) return res.status(401).json({message:"User not found"});
    console.log(usedetails);
    

    res.status(200).json({usedetails});
  }catch(error){
    console.error("getMe error:", error.message);
    res.status(500).json({message:"Server error",error});
  }
};

export const logoutUser = async (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
};




// send otp
export const sendOtp = async (req, res) => {
  const { mobile } = req.body;
  console.log(mobile,req.body);
  
  try {
    const otp = await sendOtpSms(mobile);
    res.status(200).json({message:"otp sent succefully"});
  }catch (error){
    res.status(500).json({message:error.message})
  }
};

// verify otp
export const verifyOtp = async (req, res) => {
  const { mobile, otp } = req.body;
  if(!mobile || !otp){
    return res.status(400).json({message:"Mobile and OTP are required"});
  }

  const storedOtp = otpStore[mobile];

  if(!storedOtp) {
    return res.status(400).json({message:"Mobile and OT"});
  }

  if(storedOtp.toString() !== otp.toString()){
    return res.status(400).json({message:"Invalid OTP"});
  }

  let user = await User.findOne({mobile});

  if(!user){
   delete otpStore[mobile];
    return res.status(200).json({
      message: "OTP Verified - user not found",
      redirect: true,
      mobile, // send mobile so frontend can pre-fill registration form
    });
  }

  const token = createLoginToken(user._id);

  console.log(token,'hello');
  

  res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    });

  delete otpStore[mobile];

  return res.status(200).json({message:"OTP Verified successfully",
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    },
    redirect:false,
  });

  
};

export const updateuserprofile = async (req, res) => {
  try {
    const {
      id,
      you_are,
      name,
      email,
      company_name,
      company_url,
      phone,
      company_profile,
      address,
      landline
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    // ✅ validation (same as yours)
    if (!you_are) return res.status(400).json({ message: "Enter who you are" });
    if (!name) return res.status(400).json({ message: "Enter name" });
    if (!email) return res.status(400).json({ message: "Enter email" });
    if (!address) return res.status(400).json({ message: "Enter address" });

    // ✅ safe update object
    const updateData = {
      you_are,
      name,
      email,
      company_name,
      company_url,
      company_profile,
      address,
      phone,
      landline
    };

    console.log(req.files);
    

    // ✅ handle images safely
    if (req.files?.profile) {
      updateData.profile = req.files.profile[0].location;
    }

    if (req.files?.logo) {
      updateData.logo = req.files.logo[0].location;
    }

    // ✅ update user
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: user
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
