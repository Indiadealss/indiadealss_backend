import picture from "../models/picture.js";

export const createPicture = async (req,res) => {

    try {
        const { name } = req.body

        if(!name){
            return res.status(400).json({success:false,message: "Name field can't be emity"})
        }

        if(!req.file){
            return res.status(400).json({success:false,message: "icon must be there"})
        }

        const iconURL = req.file.location; // url

        const exist = await picture.findOne({name});

        if(exist){
            return res.status(400).json({success:false,message:'additionalFeatures Already exist'});
        }

        const additionalFeatures = await picture.create({
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