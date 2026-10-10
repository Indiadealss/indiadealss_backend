import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Separate connection for form submissions coming from external websites.
// Uses FORM_MONGO_URI so the data lands in a different database than the main app.
// If FORM_MONGO_URI is not set, it uses the main cluster with a separate "website_forms" database.
const formDB = process.env.FORM_MONGO_URI
    ? mongoose.createConnection(process.env.FORM_MONGO_URI)
    : mongoose.createConnection(process.env.MONGO_URI, { dbName: 'website_forms' });

formDB.on('connected', () => console.log('✅ Form MongoDB connected'));
formDB.on('error', (error) => console.error('Form MongoDB connection error:', error.message));

export default formDB;
