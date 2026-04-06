import multer from "multer";
import multerS3 from "multer-s3"
import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";


dotenv.config();

const s3 = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});



const upload = multer({

    storage: multerS3({
        s3,
        bucket: process.env.AWS_BUCKET,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req,file,cb){
            cb(null,{filedName:file.fieldname});
        },
        key:function (req,file,cb){
            // Customize folder
            const folder = "brandsdoor";
            // Customize file name
            cb(null,`${folder}/${Date.now().toString()}-${file.originalname}`);
        },
    }),
});

export default upload;