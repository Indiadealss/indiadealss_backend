import mongoose from "mongoose";
import formDB from "../config/formDb.js";

// Running sequence numbers, one document per counter name (e.g. "plotToken")
const counterSchema = new mongoose.Schema({
    _id:{ type:String },
    seq:{ type:Number, default:0 }
});

const Counter = formDB.model("Counter",counterSchema);

// Atomically increments and returns the next number, so parallel requests never get the same one
export const nextSequence = async (name) => {
    const counter = await Counter.findOneAndUpdate(
        { _id:name },
        { $inc:{ seq:1 } },
        { new:true, upsert:true }
    );
    return counter.seq;
};

export default Counter;
