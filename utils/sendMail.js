import nodemailer from "nodemailer";
import { google } from "googleapis";
import path from "path";

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure:false,
    auth: {
        user: process.env.MAIL_USER, // your  email
        pass: process.env.MAIL_PASS // app password
    }
}); 

export const sendLeadMail = async (lead,property,propertyOwner, leadData) => {
    console.log(propertyOwner.email,'email of owner',process.env.MAIL_USER,'mail user');
    const mailOptions = {
        from: process.env.MAIL_USER,
    to: propertyOwner.email,
    subject: "New Lead Generated",
    html: `
      <h2>New Lead Details</h2>
      <p><b>Name:</b> ${lead.Name || "Guest"}</p>
      <p><b>Phone:</b> ${lead.PhoneNumber}</p>
      <p><b>Email:</b> ${leadData.email || "-"}</p>
      <p><b>Project:</b> ${property.projectname}</p>
      <p><b>Purpose:</b> ${lead.purpose || "-"}</p>
      <p><b>Message:</b> ${lead.message || "-"}</p>
      <hr />
      <p>Generated at: ${new Date().toLocaleString()}</p>
      `
    };
    console.log(propertyOwner.email,'email of owner');
    

    await transporter.sendMail(mailOptions);
};

export const sendMailmessage = async (data, leadData) => {

  console.log(data, leadData, 'hello sir');
  
  const mailOptions = {
        from: process.env.MAIL_USER,
        to: 'brandsdoor.in@gmail.com',
        subject: "New Lead Generated",
        html: `
      <h2>New Lead Details</h2>
      <p><b>Name:</b> ${data.Name || "Guest"}</p>
      <p><b>Phone:</b> ${data.PhoneNumber}</p>
      <p><b>Email:</b> ${leadData.email || "-"}</p>
      <p><b>Project:</b> ${data.projectname}</p>
      <p><b>Purpose:</b> ${data.requirement || "-"}</p>
      <p><b>Message:</b> ${data.message || "-"}</p>
      <hr />
      <p>Generated at: ${new Date().toLocaleString()}</p>
      `
    };
    await transporter.sendMail(mailOptions);
    
}


const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), "utils/credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

export const addData = async (data, leadData) => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error("❌ GOOGLE_SHEET_ID missing in .env");
    }

    const now = new Date();

    const time = now.toLocaleTimeString("en-IN", {
  timeZone: "Asia/Kolkata",
});

  console.log(leadData,'leadData')
    const row = [[
      now.toLocaleDateString(),
      time,
      data.projectname || "",
      data.Name || "",
      data.PhoneNumber || "",
      leadData?.email || "",
      data.message || data.purpose || "-"
    ]];

    // 🔥 Force auth check (important for debugging)
    await auth.getClient();
    console.log("✅ Google Auth Success");

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: row,
      },
    });

    console.log("✅ Data added to Google Sheet");
    return response.data;

  } catch (error) {
    console.error("❌ Google Sheets Error:");
    console.error(error.response?.data || error.message || error);
  }
};

export const addHomeData = async (data, leadData) => {
  try {
    const spreadsheetIdHome = process.env.Home_page_SHEET_ID;

    if (!spreadsheetIdHome) {
      throw new Error("❌ Home_page_SHEET_ID missing in .env");
    }

    const now = new Date();

    const time = now.toLocaleTimeString("en-IN", {
  timeZone: "Asia/Kolkata",
});

  console.log(leadData,'leadData')
    const row = [[
      now.toLocaleDateString(),
      time,
      data.projectname || "",
      data.Name || "",
      data.PhoneNumber || "",
      leadData?.email || "",
      data.message ||  "-"
    ]];

    // 🔥 Force auth check (important for debugging)
    await auth.getClient();
    console.log("✅ Google Auth Success");

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetIdHome,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: row,
      },
    });

    console.log("✅ Data added to Google Sheet");
    return response.data;

  } catch (error) {
    console.error("❌ Google Sheets Error:");
    console.error(error.response?.data || error.message || error);
  }
};