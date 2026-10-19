// Mobile numbers allowed to use bulk project upload.
// Keep in sync with BULK_UPLOAD_MOBILES in the frontend (src/utils/permissions.js).
export const BULK_UPLOAD_MOBILES = ["+917906518272"];

// compare on the last 10 digits so "+91 79065 18272", "917906518272" and "7906518272" all match
const last10 = (mobile) => String(mobile || "").replace(/\D/g, "").slice(-10);

export const canBulkUpload = (mobile) =>
  !!last10(mobile) && BULK_UPLOAD_MOBILES.some((m) => last10(m) === last10(mobile));
