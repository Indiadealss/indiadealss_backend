import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import propertyRoutes from './routes/propertyRoutes.js'
import bodyParser from "body-parser";
import citiesRoute from "./routes/citiesRoute.js"
import addresssearchRoute   from "./routes/addresssearch.js";
import featureRoute from "./routes/featureRoutes.js"
import leadRoute from "./routes/leadRoute.js";
import animitiesRoutes from "./routes/animitiesRoutes.js";
import rooms from "./routes/otheroomRoutes.js";
import propertyfeature from "./routes/propertyfeatureRoutes.js";
import additionalfeature from "./routes/additionalfeatureRoutes.js";
import overlookingfeature from "./routes/overlookingRoutes.js"
import pictureadd from "./routes/pictureRoutes.js";
import leaduserRoute from "./routes/gestLeadRoutes.js";
import adddealerRoute from "./routes/adddealerRoutes.js";
import upcomingadd from "./routes/upcomingRoutes.js"
import mycrmhomepageRoute from "./routes/mycrmhomepageRoutes.js"

dotenv.config();
connectDB();
 // header('Access-Control-Allow-Origin', '*');  // Allow all origins
  // header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  // header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
const app = express();
// middlewares
app.use(express.json({ limit: '900mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({
  //origin: process.env.CLIENT_URL,
	origin:process.env.CLIENT_URL,
	  methods: ['GET', 'POST', 'PUT','PATCH'],
    allowedHeaders: ['Content-Type','Authorization'],
}));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/property", propertyRoutes);
app.use("/api/cities",citiesRoute);
app.use("/api/searchaddress",addresssearchRoute);
app.use("/api/feature",featureRoute);
app.use("/api/aminities",animitiesRoutes);
app.use("/api/otherroom",rooms);
app.use("/api/propertyfeature",propertyfeature);
app.use("/api/additionalfeature",additionalfeature);
app.use("/api/picture",pictureadd);
app.use("/api/upcomingProjects",upcomingadd)
app.use("/api/overlookingfeature",overlookingfeature);
app.use("/api/lead",leadRoute);
app.use("/api/leaduser",leaduserRoute);
app.use("/api/adddealer",adddealerRoute);
app.use("/api/mycrmhomepage",mycrmhomepageRoute)

//app.listen(process.env.PORT, () => console.log(`Server running on :${process.env.PORT}`));

const PORT = process.env.PORT || 5001

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port:${process.env.PORT}`);
});

