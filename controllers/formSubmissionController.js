import FormSubmission from "../models/FormSubmission.js";

export const submitForm = async (req,res) => {
    try{
        const { name, mobile_no, email, message, source, ...extra } = req.body;

        if(!name){
            return res.status(400).json({success:false,message:"name must be there"})
        }

        if(!mobile_no){
            return res.status(400).json({success:false,message:"mobile_no must be there"})
        }

        const submission = await FormSubmission.create({
            name,
            mobile_no,
            email,
            message,
            source: source || req.get('origin'),
            extra,
            ip: req.headers['x-forwarded-for']?.split(',')[0] || req.ip
        });

        res.status(201).json({success:true,message:"Form submitted successfully",data:submission});
    } catch (err) {
        console.error(err);
        res.status(500).json({success:false,message:'Server Error', error: err.message});
    }
};

export const getFormSubmissions = async (req,res) => {
    try{
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = req.query.source ? { source: req.query.source } : {};

        const [data, total] = await Promise.all([
            FormSubmission.find(filter).sort({createdAt:-1}).skip(skip).limit(limit),
            FormSubmission.countDocuments(filter)
        ]);

        return res.status(200).json({
            data,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            totalItems: total
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({success:false,message:'Server Error', error: err.message});
    }
};
