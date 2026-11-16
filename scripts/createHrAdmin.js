// Create (or reset the password of) the HR admin login.
// Usage: node scripts/createHrAdmin.js <username> <employeeCode> <password> [name] [--phone=98XXXXXXXX]
// --phone turns on the login OTP for the admin (it can also be set later in the HR app, key icon at the top).
// username is the organisation name, e.g.: node scripts/createHrAdmin.js Indiadeals 989780 "<password>" HR Admin
// Employee logins are made from the HR app (set a password on the employee), not with this script.
import bcrypt from "bcrypt";
import hrDB from "../config/hrDb.js";
import HrUser from "../models/hr/HrUser.js";

const args = process.argv.slice(2);
const phoneArg = args.find((a) => a.startsWith("--phone="));
const [username, employeeCode, password, ...nameParts] = args.filter((a) => a !== phoneArg);
const phone = phoneArg ? phoneArg.slice(8).replace(/\D/g, "").slice(-10) : null;
if (phone !== null && !/^[6-9]\d{9}$/.test(phone)) {
  console.error("--phone must be a 10-digit Indian mobile number");
  process.exit(1);
}
if (!username || !employeeCode || !password) {
  console.error("Usage: node scripts/createHrAdmin.js <username> <employeeCode> <password> [name] [--phone=98XXXXXXXX]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Use a password of at least 8 characters.");
  process.exit(1);
}

try {
  await hrDB.asPromise();
  // drops indexes from the old email login (unique email / unique username), if still there
  await HrUser.syncIndexes();

  const code = employeeCode.toUpperCase().trim();
  const existing = await HrUser.findOne({ employeeCode: code });
  if (existing && existing.role !== "admin") {
    throw new Error(`Employee code ${code} already belongs to an employee login. Use a different admin code.`);
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await HrUser.findOneAndUpdate(
    { employeeCode: code },
    {
      $set: { username: username.toLowerCase().trim(), password: hash, name: nameParts.join(" ") || "HR admin", role: "admin", ...(phone ? { phone } : {}) },
      $unset: { employee: 1 }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  console.log(`HR admin login ready: ${user.username} / ${user.employeeCode} (database: ${hrDB.name})${user.phone ? `, login OTP to XXXXXX${user.phone.slice(-4)}` : ", no login OTP (no phone)"}`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await hrDB.close();
}
