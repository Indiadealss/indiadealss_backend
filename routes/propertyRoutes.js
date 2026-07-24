import express from "express";
import { getAllProperties, createProperty,getProperty, getPropertyByRera, getPropertyByspid, publishProperty, updateProperty, createPropertyBasic, uploadImage, uploadVideo, updateImageMeta, updatePropertyById, deleteImage, deleteVideo, getProjectNames, getAllProjects, getOnlyProperties, getPendingProperties, approveProperty, rejectProperty } from "../controllers/propertyController.js";
import upload from "../config/multers3.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
//import sessionMiddleware from "../middleware/sessionMiddleware.js";

const router = express.Router();

// Admin — property approval workflow
router.get("/admin/pending", authMiddleware, adminMiddleware, getPendingProperties);
router.put("/admin/:id/approve", authMiddleware, adminMiddleware, approveProperty);
router.put("/admin/:id/reject", authMiddleware, adminMiddleware, rejectProperty);

router.get("/getAllProperties",  getAllProperties);
router.get("/getOnlyProperties",getOnlyProperties);
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
router.put("/updatePropertyById/:id",updatePropertyById)
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
router.delete("/image/:id/:imageId", deleteImage);
router.delete("/video/:id/:videoId", deleteVideo);
router.get("/propertyName",getProjectNames);
router.get("/getAllProjects",getAllProjects)

export default router;
