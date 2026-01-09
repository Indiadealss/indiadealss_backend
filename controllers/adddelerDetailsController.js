import adddealerdetails from "../models/adddealerdetails.js";
import Property from "../models/Property.js";
import User from "../models/User.js";


export const createdealer = async (req, res) => {
    try {
       const {name,npxid,reranumber, number} = req.body || {};

    //    const images = req.file.location;

    if(!req.file){
            return res.status(400).json({success:false,message: "icon must be there"})
        }

        const images = req.file.location; // url

        if(!name){
            return res.status(400).json({success:false,message:"Valid name is required"});
        }

        if(!npxid){
            return res.status(400).json({success:false,message:"Valid npxid is required"});
        }

        if(!number){
            return res.status(400).json({success:false,message:"Valid number is required"});
        }

        const projectId = await Property.find({npxid})

        const userId = await User.find({mobile:`+91${number}`})

        console.log(images);
        


        const delears =  await adddealerdetails.create({
            user_id: userId[0]._id,
            property_id:projectId[0]._id,
            rera:reranumber,
            logo:images,
            userType:'Property Advisor'
        })

        return res.status(201).json({success:true,message:'created',data:delears})
        
        
    } catch (error) {
        console.log(error);
        return res.status(500).json({success:false,message:'server error'});
    }
}



export const getcampain = async (req,res) => {
    try {
        const campaindealer = await adddealerdetails.find()
        .populate("user_id", "name email mobile")
        .populate("property_id", "npxid projectname location");

        return res.status(200).json({success:false,message:'Data Received',data:campaindealer})
    } catch (error) {
        return res.status(500).json({success:false,message:'Server Error'})
    }
}


export const getcampainbyid = async (req,res) => {
    try {
        const  { npxid } = req.params;

        const campaindealer = await adddealerdetails.findOne({ npxid })
        .populate("user_id", "name email mobile")
        .populate("property_id", "npxid projectname location");

        if(!campaindealer){
            return res.status(404).json({message: "Property not found"}); 
        }

        res.status(200).json(campaindealer);
    } catch (error) {
        res.status(500).json({message: 'Server Error'});
    }
}