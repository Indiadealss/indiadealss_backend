import Property from "./Property";
import mongoose from "mongoose";

const commercialSchema = new mongoose.Schema({
    amenities:[String],
    size: Number,
    floors:Number
});

export default Property.discriminator("commerical",commercialSchema);

