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

const project = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    rera:{
        type:String,
        required:true
    }

})
const MapingSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    locality:{
        type:String,
        default:'locality',
        required:true
    },
    address:{
        type:String,
        required:true,
        unique:true
    },
    city:{
        type:String,
        required:true
    },
    state:{
        type:String,
        required:false
    },
    pincode:{
        type: String,
        required:true
    },
    country:{
        type:String,
        required:true
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