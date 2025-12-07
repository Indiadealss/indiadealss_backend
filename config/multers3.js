import multer from "multer";
import multerS3 from "multer-s3"
import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3"
// import { credentials } from "aws-sdk";



dotenv.config();

const endpointRaw = process.env.MINIO_ENDPOINT || "";

if (!endpointRaw) {
  throw new Error("MINIO_ENDPOINT is not set. Add MINIO_ENDPOINT=http://<host>:9000 to your .env");
}

let endpointUrl;
try {
  // ensure a proper URL (adds http:// if user omitted it)
  endpointUrl = endpointRaw.match(/^https?:\/\//) ? endpointRaw : `http://${endpointRaw}`;
  // this will throw if still invalid
  new URL(endpointUrl);
} catch (err) {
  throw new Error(`MINIO_ENDPOINT is not a valid URL: "${endpointRaw}". Provide something like http://15.235.131.103:9000`);
}

const s3 = new S3Client({
    region:"us-east-1", //required but ignored by MinIO
    endpoint:endpointUrl,
    forcePathStyle: true,    //VERY IMPORTANT for MiniIO
    credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
});



const upload = multer({

    storage: multerS3({
        s3,
        bucket: process.env.MINIO_BUCKET,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        // acl:"public-read", // so URL is accessible
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