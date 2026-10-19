import User from "../models/User.js";
import { canBulkUpload } from "../utils/bulkUploadAccess.js";

// Must run after authMiddleware so req.user is populated.
// The mobile is read from the database, not the token, so it can't be spoofed.
const bulkUploadMiddleware = async (req, res, next) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("mobile");
    if (!canBulkUpload(user?.mobile)) {
      return res.status(403).json({ message: "Bulk upload is not allowed for this account" });
    }

    req.bulkUser = user;
    next();
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export default bulkUploadMiddleware;
