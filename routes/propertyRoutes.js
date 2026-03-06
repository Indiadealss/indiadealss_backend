import express from "express";
import { getAllProperties, createProperty,getProperty, getPropertyByRera, getPropertyByspid, publishProperty, updateProperty, createPropertyBasic, uploadImage, uploadVideo, updateImageMeta } from "../controllers/propertyController.js";
import upload from "../config/multers3.js";
//import sessionMiddleware from "../middleware/sessionMiddleware.js";

const router = express.Router();

router.get("/getAllProperties",  getAllProperties);
router.post("/createProperty",
     upload.fields([
      {name:"images",maxCount:30},
      {name:"video",maxCount:30}
    ]),
     createProperty);
router.get("/getProperty/:id", getProperty); 
router.get("/getPropertyByRera/:npxid", getPropertyByRera);
router.get("/getPropertyByspid/:spid",getPropertyByspid);
router.post("/createPropertyBasic", createPropertyBasic);
router.put("/updateProperty/:id", updateProperty);
router.post(
  "/uploadImage/:id",
  upload.single("image"),
  uploadImage
);
router.post(
  "/uploadVideo/:id",
  upload.single("video"),
  uploadVideo
);
router.put("/updateImageMeta/:id/:imageId", updateImageMeta);
router.put("/publishProperty/:id", publishProperty);

export default router;
