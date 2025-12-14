import Amenities from "../models/Amenities.js";

export const createamenities = async (req,res) => {

    try {
        const { name } = req.body

        if(!name){
            return res.status(400).json({success:false,message: "Name field can't be emity"})
        }

        if(!req.file){
            return res.status(400).json({success:false,message: "icon must be there"})
        }

        const iconURL = req.file.location; // url

        const exist = await Amenities.findOne({name});

        if(exist){
            return res.status(400).json({success:false,message:'Amenties Already exist'});
        }

        const amenities = await Amenities.create({
            name,
            label:name,
            icon:iconURL,
        })

        res.status(201).json({
            success:true,
            message:'amenities',
            data:amenities
        })
    }catch(err){
        console.log(err);
        return res.status(500).json({success:false,message:"server Error",error:err.message})
        
    }
}


export const getanimities = async (req,res) => {
    try {
        const animites = await Amenities.find().sort({createdAt: -1});

        res.status(200).json({
            success:true,
            count:animites.length,
            data:animites
        })
    } catch (err) {
        return res.status(500).json({success:false,message:"server Error",error:err.message})
    }
}