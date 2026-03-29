import mongoose from "mongoose";

const imagesSchema = new mongoose.Schema({
    src:{
        type:String,
        unique:false,
        require:true
    },
    type:{
        type:String,
        default:'',
    },
    fields: {
    type: [
      {
        key: { type: String },
        value: { type: String }
      }
    ],
    default: []
}
})


const videoSchema = new mongoose.Schema({
  src: {
    type: String,
    required: true
  }
});

const PropertySchema = new mongoose.Schema({
 
  npxid:{
    type:String,
    unique:true,
    sparse:true,
    default: undefined   // 🔥 important
  },
  spid:{
    type: String,
    unique:true,
    sparse:true,
    default: undefined   // 🔥 important
  },
    location:{
        type:Object,
        required:true
    },
    images:{
        type:[imagesSchema],
        default:[],
        required:false,
    },
      video: {
    type: [videoSchema],   // ✅ ADD THIS
    default: []
  },
    owners_type:{
      type:String
    },
   owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
   Buldingfeature:[{type: mongoose.Schema.Types.ObjectId, ref:'Feature'}],
   amenitie:[{type:mongoose.Schema.Types.ObjectId,ref:'Amenities'}],
   otherrooms:[{type:mongoose.Schema.Types.ObjectId,ref:'otheroom'}],
   propertyfeature:[{type:mongoose.Schema.Types.ObjectId,ref:'Propertyfeatures'}],
   addFeature:[{type:mongoose.Schema.Types.ObjectId,ref:'additionalfeatures'}],
   overlo:[{type:mongoose.Schema.Types.ObjectId,ref:'additionalfeatures'}],
},{strict: false,timestamps:true})

export default mongoose.model("Property", PropertySchema);