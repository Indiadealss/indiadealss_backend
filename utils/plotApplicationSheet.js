import axios from "axios";

// Writes plot applications to the Google Sheet through an Apps Script web app.
// The script is bound to the sheet and deployed as a web app (Execute as: Me, Access: Anyone);
// PLOT_SHEET_SCRIPT_SECRET must match the SECRET constant inside the script.

const istDate = (d) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
const istTime = (d) => d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
const istDateTime = (d) => (d ? `${istDate(d)} ${istTime(d)}` : "");

// Sheets would treat long numbers (Aadhaar, mobile) as numbers and mangle them
const asText = (v) => (v ? `'${v}` : "");

const buildRow = (app) => {
  const created = app.createdAt || new Date();
  const docs = app.documents || {};
  return [
    app.applicationId, istDate(created), istTime(created), app.plot, app.bookingAmount,
    app.name, app.fatherName, asText(app.phone), app.email, asText(app.aadhaar), app.pan || "",
    app.address, app.city, asText(app.pincode),
    docs.aadhaarCard?.url || "", docs.panCard?.url || "", docs.photo?.url || "",
    app.orderId || "", app.status, app.paymentId || "", istDateTime(app.paidAt)
  ];
};

const callScript = async (payload) => {
  const url = process.env.PLOT_SHEET_SCRIPT_URL;
  if (!url) throw new Error("PLOT_SHEET_SCRIPT_URL missing in .env");

  const { data } = await axios.post(
    url,
    { secret: process.env.PLOT_SHEET_SCRIPT_SECRET, ...payload },
    { timeout: 20000 }
  );

  // Apps Script always answers 200, so check the body for failures
  if (!data?.success) {
    throw new Error(`Apps Script: ${data?.message || (typeof data === "string" ? data.slice(0, 200) : "unknown error")}`);
  }
  return data;
};

export const appendPlotApplication = async (app) => {
  await callScript({ action: "append", row: buildRow(app) });
};

// Finds the application's row by Application ID and updates its payment columns.
// If the row is missing (e.g. the first append failed) the script adds the full row instead.
export const updatePlotApplicationStatus = async (app) => {
  await callScript({
    action: "updateStatus",
    applicationId: app.applicationId,
    values: [app.status, app.paymentId || "", istDateTime(app.paidAt)],
    row: buildRow(app),
  });
};
