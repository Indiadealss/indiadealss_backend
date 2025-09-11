import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import propertyRoutes from './routes/propertyRoutes.js'

// const express = require("express");




import bodyParser from "body-parser";
// import connectDB from "./config/db.js";
// import authRoutes from "./routes/authRoutes.js";


dotenv.config();
connectDB();

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

app.use("/api/auth", authRoutes);
app.use("/property", propertyRoutes);

app.listen(process.env.PORT, () => console.log(`Server running on http://localhost:${process.env.PORT}`));



// middlewares
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// routes
app.use("/api/auth", authRoutes);

app.listen(5000, () => console.log("✅ Server running on port 5000"));





// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import cookieParser from "cookie-parser";
// import bodyParser from "body-parser";
// import connectDB from "./config/db.js";
// import authRoutes from "./routes/authRoutes.js";

// dotenv.config();
// connectDB();

// const app = express();

// // middlewares
// app.use(cors({ origin: "http://localhost:3000", credentials: true }));
// app.use(bodyParser.json());
// app.use(cookieParser());

// // routes
// app.use("/api/auth", authRoutes);

// app.listen(5000, () => console.log("✅ Server running on port 5000"));