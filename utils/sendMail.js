import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure:false,
    auth: {
        user: process.env.MAIL_USER, // your  email
        pass: process.env.MAIL_PASS // app password
    }
}); 

export const sendLeadMail = async (lead,property,propertyOwner) => {
    console.log(propertyOwner.email,'email of owner',process.env.MAIL_USER,'mail user');
    const mailOptions = {
        from: process.env.MAIL_USER,
    to: propertyOwner.email,
    subject: "New Lead Generated",
    html: `
      <h2>New Lead Details</h2>
      <p><b>Name:</b> ${lead.Name || "Guest"}</p>
      <p><b>Phone:</b> ${lead.PhoneNumber}</p>
      <p><b>Project:</b> ${property.projectname}</p>
      <p><b>Purpose:</b> ${lead.purpose}</p>
      <p><b>Message:</b> ${lead.message || "-"}</p>
      <hr />
      <p>Generated at: ${new Date().toLocaleString()}</p>
      `
    };
    console.log(propertyOwner.email,'email of owner');
    

    await transporter.sendMail(mailOptions);
};