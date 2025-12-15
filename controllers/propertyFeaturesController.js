import Propertyfeatures from "../models/propertyfeatures.js";

export const createpropertyFeature = async (req,res) => {

    try {
        const { name } = req.body

        if(!name){
            return res.status(400).json({success:false,message: "Name field can't be emity"})
        }

        if(!req.file){
            return res.status(400).json({success:false,message: "icon must be there"})
        }

        const iconURL = req.file.location; // url

        const exist = await Propertyfeatures.findOne({name});

        if(exist){
            return res.status(400).json({success:false,message:'propertyFeature Already exist'});
        }

        const propertyFeature = await Propertyfeatures.create({
            name,
            label:name,
            icon:iconURL,
        })

        res.status(201).json({
            success:true,
            message:'amenities',
            data:propertyFeature
        })
    }catch(err){
        console.log(err);
        return res.status(500).json({success:false,message:"server Error",error:err.message})
        
    }
}


export const getpropertyFeature = async (req,res) => {
    try {
        const propertyFeature = await Propertyfeatures.find().sort({createdAt: -1});

        res.status(200).json({
            success:true,
            count:propertyFeature.length,
            data:propertyFeature
        })
    } catch (err) {
        return res.status(500).json({success:false,message:"server Error",error:err.message})
    }
}