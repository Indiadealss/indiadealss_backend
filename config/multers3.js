import multer from "multer";
import multerS3 from "multer-s3"
import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3"
// import { credentials } from "aws-sdk";



dotenv.config();

const s3 = new S3Client({
    region:process.env.AWS_REGION,
    credentials:{
         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});



const upload = multer({
    storage: multerS3({
        s3,
        bucket: process.env.S3_BUCKET_NAME,
        acl:"public-read", // so URL is accessible
        metadata: function (req,file,cb){
            cb(null,{filedName:file.fieldname});
        },
        key:function (req,file,cb){
            // Customize folder
            const folder = "indiadealss";
            // Customize file name
            cb(null,`${folder}/${Date.now().toString()}-${file.originalname}`);
        },
    }),
});

export default upload;