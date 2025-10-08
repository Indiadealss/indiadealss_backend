import City from "../models/City.js";

export const searchCity = async (req,res) => {
    try{
        const { query } = req.query; // ?query=del

        if(!query){
            return res.status(400).json({success:false,message:"Query is required"});
        }

        //Case-insensitive partial search
        const citiees = await City.find({
            city:{$regex:query,$options:'i'},
        }).limit(10);

        res.json({success:true,count:citiees.length,data:citiees});

    }catch(err){
            res.status(500).json({success:false,message:"Server Error"})
    }
};