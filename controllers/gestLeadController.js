import gestLead from "../models/gestLead.js";

export const genrateLeadUser = async (req,res) => {
    try{
        
        const { user_name,property_id,message,mobile_no, ...leadData} = req.body;

        console.log(req.body)

        if(!user_name){
            return res.status(400).json({success:false,message:"user_name must be there"})
        }

        if(!property_id){
            return res.status(400).json({success:false,message:' any property_id or project_id must be there '})
        }

        const lead = await gestLead.create({
           user_name,
           property_id,
           mobile,
           message,
        ...leadData
        });

        res.status(201).json({success:true,lead});
    } catch (err) {
        console.error(err);
        res.status(500).json({success:false,message:'Server Error', error: err.message});
    }
};


export const getLeadByUser = async (req,res) => {
    try{

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
    
        const lead = await gestLead.find()
        .populate('user_id','name mobile email ')
        .populate('property_id')
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const total =  await gestLead.countDocuments();

        return res.status(200).json({
            data: lead,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            totalItems:total
        });


    }catch (err){
        console.log(err);
        return res.status(500).json({success:false,message:'server Error',error:err.message});
    }
};