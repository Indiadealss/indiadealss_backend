import additionalfeatures from "../models/additionalfeatures.js";

export const createadditionalFeature = async (req,res) => {

    try {
        const { name } = req.body

        if(!name){
            return res.status(400).json({success:false,message: "Name field can't be emity"})
        }

        if(!req.file){
            return res.status(400).json({success:false,message: "icon must be there"})
        }

        const iconURL = req.file.location; // url

        const exist = await additionalfeatures.findOne({name});

        if(exist){
            return res.status(400).json({success:false,message:'additionalFeatures Already exist'});
        }

        const additionalFeatures = await additionalfeatures.create({
            name,
            label:name,
            icon:iconURL,
        })

        res.status(201).json({
            success:true,
            message:'amenities',
            data:additionalFeatures
        })
    }catch(err){
        console.log(err);
        return res.status(500).json({success:false,message:"server Error",error:err.message})
        
    }
}


export const getadditionalFeature = async (req,res) => {
    try {
        const additionalFeatures = await additionalfeatures.find().sort({createdAt: -1});

        res.status(200).json({
            success:true,
            count:additionalFeatures.length,
            data:additionalFeatures
        })
    } catch (err) {
        return res.status(500).json({success:false,message:"server Error",error:err.message})
    }
}