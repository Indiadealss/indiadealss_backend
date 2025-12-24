import express from "express";
import { getAllProperties, createProperty,getProperty, getPropertyByRera, getPropertyByspid } from "../controllers/propertyController.js";
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

export default router;
