import otheroom from "../models/otheroom.js";

export const createotheroom = async (req,res) => {

    try {
        const { name } = req.body

        if(!name){
            return res.status(400).json({success:false,message: "Name field can't be emity"})
        }

        if(!req.file){
            return res.status(400).json({success:false,message: "icon must be there"})
        }

        const iconURL = req.file.location; // url

        const exist = await otheroom.findOne({name});

        if(exist){
            return res.status(400).json({success:false,message:'Amenties Already exist'});
        }

        const otherroomdata = await otheroom.create({
            name,
            label:name,
            icon:iconURL,
        })

        res.status(201).json({
            success:true,
            message:'amenities',
            data:otherroomdata
        })
    }catch(err){
        console.log(err);
        return res.status(500).json({success:false,message:"server Error",error:err.message})
        
    }
}


export const getotheroom = async (req,res) => {
    try {
        const otherroom = await otheroom.find().sort({createdAt: -1});

        res.status(200).json({
            success:true,
            count:otherroom.length,
            data:otherroom
        })
    } catch (err) {
        return res.status(500).json({success:false,message:"server Error",error:err.message})
    }
}