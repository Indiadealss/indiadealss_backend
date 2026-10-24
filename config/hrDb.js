import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Separate connection for the HR & attendance app (employees, punches, leave, payroll rules).
// Uses HR_MONGO_URI so HR data lives in its own database, away from the property portal.
// If HR_MONGO_URI is not set, it uses the main cluster with a separate "indiadeals_hr" database.
const hrDB = process.env.HR_MONGO_URI
    ? mongoose.createConnection(process.env.HR_MONGO_URI)
    : mongoose.createConnection(process.env.MONGO_URI, { dbName: 'indiadeals_hr' });

hrDB.on('connected', () => console.log('✅ HR MongoDB connected'));
hrDB.on('error', (error) => console.error('HR MongoDB connection error:', error.message));

export default hrDB;
