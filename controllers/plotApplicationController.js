import PlotApplication from "../models/PlotApplication.js";
import { appendPlotApplication, updatePlotApplicationStatus } from "../utils/plotApplicationSheet.js";

const REQUIRED = ["applicationId","plot","bookingAmount","name","fatherName","phone","email","aadhaar","address","city","pincode"];

const toDocument = (file) => file && {
    url: file.location,
    key: file.key,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size
};

// Saves a plot application with its documents and adds it to the Google Sheet
export const createPlotApplication = async (req,res) => {
    try{
        const body = req.body;
        const missing = REQUIRED.filter(f => !String(body[f] ?? '').trim());
        if(missing.length){
            return res.status(400).json({success:false,message:`Missing fields: ${missing.join(', ')}`});
        }

        const files = req.files || {};
        if(!files.aadhaarCard?.[0]){
            return res.status(400).json({success:false,message:"Aadhaar card document is required"});
        }

        const application = await PlotApplication.create({
            applicationId: body.applicationId,
            plot: body.plot,
            bookingAmount: Number(body.bookingAmount),
            name: body.name,
            fatherName: body.fatherName,
            phone: body.phone,
            email: body.email,
            aadhaar: body.aadhaar,
            pan: body.pan,
            address: body.address,
            city: body.city,
            pincode: body.pincode,
            documents: {
                aadhaarCard: toDocument(files.aadhaarCard?.[0]),
                panCard: toDocument(files.panCard?.[0]),
                photo: toDocument(files.photo?.[0])
            },
            orderId: body.orderId,
            source: body.source || req.get('origin'),
            ip: body.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.ip
        });

        // The application is already saved, so a sheet failure should not fail the request
        try{
            await appendPlotApplication(application);
            application.sheetSynced = true;
            await application.save();
        } catch (sheetErr) {
            console.error("Google Sheets error (plot application):", sheetErr.response?.data || sheetErr.message);
        }

        res.status(201).json({success:true,message:"Application submitted successfully",data:{
            applicationId: application.applicationId,
            documents: application.documents
        }});
    } catch (err) {
        console.error(err);
        if(err.code === 11000){
            return res.status(409).json({success:false,message:"Application ID already exists"});
        }
        res.status(500).json({success:false,message:'Server Error', error: err.message});
    }
};

// Marks an application as paid. Called by the micro-site server after it verifies the Razorpay signature.
export const markPlotApplicationPaid = async (req,res) => {
    try{
        const { orderId, paymentId } = req.body;
        if(!orderId || !paymentId){
            return res.status(400).json({success:false,message:"orderId and paymentId are required"});
        }

        const application = await PlotApplication.findOne({ applicationId: req.params.applicationId, orderId });
        if(!application){
            return res.status(404).json({success:false,message:"Application not found"});
        }

        if(application.status !== 'paid'){
            application.status = 'paid';
            application.paymentId = paymentId;
            application.paidAt = new Date();
            await application.save();
        }

        try{
            await updatePlotApplicationStatus(application);
        } catch (sheetErr) {
            console.error("Google Sheets error (plot payment):", sheetErr.response?.data || sheetErr.message);
        }

        res.status(200).json({success:true,message:"Payment recorded"});
    } catch (err) {
        console.error(err);
        res.status(500).json({success:false,message:'Server Error', error: err.message});
    }
};

export const getPlotApplications = async (req,res) => {
    try{
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = req.query.status ? { status: req.query.status } : {};

        const [data, total] = await Promise.all([
            PlotApplication.find(filter).sort({createdAt:-1}).skip(skip).limit(limit),
            PlotApplication.countDocuments(filter)
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
