import nodemailer from "nodemailer";
import fs from "fs";
import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

// Payslip emails from the HR app. Uses HR_MAIL_USER / HR_MAIL_PASS (a Gmail app password),
// or the portal's MAIL_USER / MAIL_PASS when those aren't set.
const user = () => process.env.HR_MAIL_USER || process.env.MAIL_USER;
const pass = () => process.env.HR_MAIL_PASS || process.env.MAIL_PASS;

const extraCa = process.env.SMTP_EXTRA_CA && fs.existsSync(process.env.SMTP_EXTRA_CA)
  ? { ca: [...tls.rootCertificates, fs.readFileSync(process.env.SMTP_EXTRA_CA, "utf8")] }
  : undefined;

let transporter;
const getTransporter = () => {
  transporter ||= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: user(), pass: pass() },
    tls: extraCa
  });
  return transporter;
};

export const hrMailReady = () => !!(user() && pass());

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// pdfBase64: the payslip PDF made in the browser
export const sendPayslipMail = async ({ to, company, employeeName, monthLabel, net, pdfBase64, filename }) => {
  await getTransporter().sendMail({
    from: `"${company} HR" <${user()}>`,
    to,
    subject: `Payslip for ${monthLabel} - ${company}`,
    html: `
      <p>Dear ${esc(employeeName)},</p>
      <p>Please find attached your payslip for <b>${esc(monthLabel)}</b>.</p>
      <p>Net pay: <b>₹${Number(net || 0).toLocaleString("en-IN")}</b></p>
      <p>This is a system-generated email. For any questions about your salary, please contact HR.</p>
      <p>Regards,<br/>${esc(company)} HR</p>`,
    attachments: [{ filename, content: Buffer.from(pdfBase64, "base64"), contentType: "application/pdf" }]
  });
};
