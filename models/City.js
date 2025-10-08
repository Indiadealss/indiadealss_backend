import mongoose from "mongoose";

const citySchema = new mongoose.Schema({
    city:{
        type:String,
        required:true
    },
    state:{
        type:String
    },
    country:{
        type:String,
        default:"India"
    },
});

export default mongoose.model("City",citySchema,"cities");