import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({
    lat:{
        type:Number,
        required:true,
    },
    lng:{
        type:Number,
        required:true
    }
})

const MapingSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    address:{
        type:String,
        required:true,
        unique:true
    },
    location:{
        type:locationSchema,
        required:true
    },
    place_id:{
        type:String,
        required:true
    },
    
});

const Mapping = mongoose.model("Maping",MapingSchema)

export default Mapping;