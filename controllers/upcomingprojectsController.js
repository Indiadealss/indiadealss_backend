import upcomingproject from "../models/upcomingproject.js";

export const createUpcomming = async (req,res) => {

    try {
        const { name } = req.body

        if(!name){
            return res.status(400).json({success:false,message: "Name field can't be emity"})
        }

        if(!req.file){
            return res.status(400).json({success:false,message: "icon must be there"})
        }

        const images = req.file.location; // url

        const exist = await upcomingproject.findOne({name});

        if(exist){
            return res.status(400).json({success:false,message:'additionalFeatures Already exist'});
        }

        const additionalFeatures = await upcomingproject.create({
            name,
            label:name,
            banner:images,
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


export const getUpcomming = async (req,res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limin) || 10;
        const skip = (page - 1) * limit;

        const projectpicture = await upcomingproject.find()
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit);

        
        const total = await upcomingproject.countDocuments();

        return res.status(200).json({
            data : projectpicture,
            page,
            limit,
            totalpages: Math.ceil(total/limit),
            totalItems: total
        })
    } catch (error) {
        return res.status(500).json({success:false,message: 'Server Error',error: err.message})
    }
}