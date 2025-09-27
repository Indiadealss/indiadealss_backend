import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import propertyRoutes from './routes/propertyRoutes.js'
import bodyParser from "body-parser";

dotenv.config();
connectDB();
 // header('Access-Control-Allow-Origin', '*');  // Allow all origins
  // header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  // header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
const app = express();
// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({
  //origin: process.env.CLIENT_URL,
	origin:process.env.CLIENT_URL,
	  methods: ['GET', 'POST', 'PUT','PATCH'],
    allowedHeaders: ['Content-Type','Authorization'],
}));


// routes
app.use("/api/auth", authRoutes);
app.use("/property", propertyRoutes);

//app.listen(process.env.PORT, () => console.log(`Server running on :${process.env.PORT}`));

const PORT = process.env.PORT || 5001

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port:${process.env.PORT}`);
});

