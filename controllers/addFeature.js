import Feature from "../models/Feature.js";
import Locationadvantages from "../models/Locationadvantages.js";


export const createfeature = async (req,res) => {
    try {
        
        const {name} = req.body

        if(!name){
            return res.status(400).json({success:false,message:"Name field can't be empity"})
        }

        if(!req.file){
            return res.status(400).json({success:false,message:"Icon must be attach"})
        }

        const iconURL = req.file.location; // S3 url

         const exist = await Feature.findOne({ name });
    if (exist) {
      return res
        .status(400)
        .json({ success: false, message: "Feature already exists" });
    }

    const feature = await Feature.create({
      name,
      icon: iconURL,
    });

     res.status(201).json({
      success: true,
      message: "Feature created",
      data: feature,
    });


        
    } catch (error) {
        res.status(500).json({
            success: false,
            message:"Internal Server Error",
            error: error.message
        });
    }
}

export const getFeature = async (req,res) => {
    try {
        const features = await Feature.find().sort({createdAt: -1});

        res.status(200).json({
            success: true,
            count: features.length,
            data:features,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message:'Internal Server Error',
            error: error.message
        });
    }
};

export const localAdvantages = async (req,res) => {
    try {
        const { name } = req.body;

        if(!name){
            return res.status(400).json({success:false,message:"name field can't be empity"});
        }

        if(!req.file){
            return res.status(400).json({success:false,message:"Image must be there"});
        }

        const iconUrl = req.file.location; // s3bucket

        const existOne = await Locationadvantages.findOne({name})
        console.log("Result",existOne);
        

        if(existOne){
            return res.status(400).json({success:false,message:"LocationAvantage have already in database"})
        }

        const locationadvantage = await Locationadvantages.create({
            name:name,
            icon:iconUrl
        })

        return res.status(201).json({success:true,message:"localAdvantages created",data:locationadvantage})
    } catch (error) {
        return res.status(500).json({
            success:false,
            message:"Internal server error",
            error:error.message
        })
    }
};

export const getLocalAdvantages = async (req,res) => {
    try {

        const {name} = req.query

        console.log(name);
        
        if(!name){
           return res.status(400).json({
            success:false,
            message: 'Name is required'
           })
        }

        const locationData = await Locationadvantages.find({name})

        return res.status(201).json({
            success:true,
            data: locationData
        })
        
    } catch (error) {
        return res.status(500).json({
            success:false,
            message:'Internal server error',
            error:error.message
        })
    }
}