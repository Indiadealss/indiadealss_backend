import adddealerdetails from "../models/adddealerdetails.js";
import Lead from "../models/Lead.js";
import Property from "../models/Property.js";
import User from "../models/User.js";
import { sendmessage } from "../utils/otpHelper.js";
import { sendLeadMail } from "../utils/sendMail.js";


export const genrateLead = async (req, res) => {
    try {

        let { user_id, property_id,projectOwner, PhoneNumber, Name, ...leadData } = req.body;

        console.log(req.body)

        const leadIdentity = await user_id ? `USER_${user_id}`: `USER_${PhoneNumber}`;

        const existingLead = await Lead.findOne({
            leadIdentity,
            property_id
        })

        if(!projectOwner){
            return res.status(200).json({success: false,message: 'project owner must be there'})
        }

        if(existingLead){
            return res.status(200).json({ success: true,message : 'already saved' })
        }

        if (!property_id) {
            return res.status(400).json({ success: false, message: ' any property_id or project_id must be there ' })
        }

        

        if (!user_id || user_id === "" || user_id === "undefined") {
            user_id = undefined;
        }


        const property = await Property.findById(property_id);

        console.log(property.owner);

        const propertyOwner = await User.findById(property.owner);

       
        
        

        const lead = await Lead.create({
            user_id,
            property_id,
            leadIdentity,
            Name,
            PhoneNumber,
            spid: property.spid,
            npxid: property.npxid,
            projectOwner,
            ...leadData
        });

        await sendLeadMail(lead, property)

        await sendmessage(lead,property,propertyOwner)



        res.status(201).json({ success: true, lead });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error', error: err.message });
    }
};




export const getLead = async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const lead = await Lead.find()
            .populate('user_id', 'name mobile email ')
            .populate('property_id')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Lead.countDocuments();

        return res.status(200).json({
            data: lead,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            totalItems: total
        });


    } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: 'server Error', error: err.message });
    }
};


export const getProjectLead = async (req, res) => {
    try {

        const { user_id } = req.body || null
        const campain = await adddealerdetails.find({ user_id })
            .populate('user_id', 'name mobile email ')
            .populate('property_id')
            .sort({ createdAt: -1 })

        console.log(campain[0].property_id.npxid, 'campain', user_id);

        const npxid = await campain[0].property_id.npxid;

        const lead = await Lead.find({ npxid })
            .populate('property_id', ' projectname')




        const total = await adddealerdetails.countDocuments({ user_id })

        return res.status(200).json({
            data: lead,
            totalItems: total
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'server error', error: err.message })
    }
}