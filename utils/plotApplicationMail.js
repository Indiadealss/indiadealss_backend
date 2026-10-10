import nodemailer from "nodemailer";
import fs from "fs";
import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

// Customer mails for plot applications, sent from PLOT_MAIL_USER (Gmail app password in PLOT_MAIL_PASS).
// Document / photo links are intentionally never included.

// Optional extra CA for local machines where antivirus (e.g. AVG Mail Shield) intercepts SMTP TLS.
const extraCa = process.env.SMTP_EXTRA_CA && fs.existsSync(process.env.SMTP_EXTRA_CA)
    ? { ca: [...tls.rootCertificates, fs.readFileSync(process.env.SMTP_EXTRA_CA, "utf8")] }
    : undefined;

export const plotMailTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.PLOT_MAIL_USER,
        pass: process.env.PLOT_MAIL_PASS
    },
    tls: extraCa,
});

// Form values come from the public site, so escape them before putting them in HTML
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const istDate = (d) => (d ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "");
const istTime = (d) => (d ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) : "");

// Only the last 4 digits of Aadhaar go out by mail
const maskAadhaar = (a) => (a ? `XXXX XXXX ${String(a).replace(/\D/g, "").slice(-4)}` : "");

const row = (label, value) => `
    <tr>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:40%">${label}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(value) || "-"}</td>
    </tr>`;

const section = (title, rows) => `
    <h3 style="margin:24px 0 8px;color:#111827">${title}</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px">${rows.join("")}</table>`;

// Sends the application details to the customer: "received" after the form, "confirmed" after payment
export const sendPlotApplicationMail = async (app) => {
    if (!app.email) return;

    const created = app.createdAt || new Date();
    const paid = app.status === "paid";

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#374151">
      <h2 style="color:#111827">${paid ? "Plot Booking Confirmed" : "Plot Application Received"}</h2>
      <p>Dear ${esc(app.name)},</p>
      <p>${paid
        ? "Thank you! Your booking payment has been received. Your booking details are below."
        : "Thank you! We have received your plot application. Your details are below."}</p>
      <p style="font-size:18px">Your Token Number: <b>${esc(app.tokenNumber)}</b></p>
      ${section("Application", [
        row("Token Number", app.tokenNumber),
        row("Application ID", app.applicationId),
        row("Application Date", istDate(created)),
        row("Application Time", istTime(created)),
        row("Plot", app.plot),
        row("Booking Amount", app.bookingAmount != null ? `₹${Number(app.bookingAmount).toLocaleString("en-IN")}` : "")
      ])}
      ${section("Applicant Details", [
        row("Name", app.name),
        row("Father's / Husband's Name", app.fatherName),
        row("Mobile", app.phone),
        row("Email", app.email),
        row("Aadhaar", maskAadhaar(app.aadhaar)),
        row("PAN", app.pan),
        row("Address", app.address),
        row("City", app.city),
        row("PIN Code", app.pincode)
      ])}
      ${section("Payment Details", [
        row("Status", paid ? "Paid" : "Pending"),
        row("Order ID", app.orderId),
        row("Razorpay Payment ID", app.paymentId),
        row("Payment Receipt", app.receipt),
        row("Payment Date", istDate(app.paidAt)),
        row("Payment Time", istTime(app.paidAt))
      ])}
      <p style="margin-top:24px">Please keep your Token Number for future reference.</p>
      <p>Regards,<br/>India Deals Group</p>
    </div>`;

    const info = await plotMailTransporter.sendMail({
        from: `"India Deals Group" <${process.env.PLOT_MAIL_USER}>`,
        to: app.email,
        subject: paid
            ? `Booking Confirmed – Token ${app.tokenNumber}`
            : `Application Received – Token ${app.tokenNumber}`,
        html
    });
    console.log(`✅ Plot application mail sent: ${info.messageId} → ${info.accepted.join(", ")}`);
};
