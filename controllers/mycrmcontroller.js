import mongoose from "mongoose";
import Property from "../models/Property.js";
import Lead from "../models/Lead.js";

export const getycrmhomepage = async (req,res) => {
    try {
        const id = req.query.id || '';
        
        // const leads = await Lead.countDocuments({owner:id})
        const propertyDetails = await Property.find({owner:id})
        let data = [];
        let leads = [];
        const element = propertyDetails[0]._id;
        const leadsdetails = await Lead.find({property_id:element,user_id:id})
        console.log(propertyDetails.length);
        data.push(propertyDetails,leadsdetails)
       

        res.status(200).json({
      data: data,
    });
        
    } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message })
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors
      })
    }
  }
}