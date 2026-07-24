import User from "../models/User.js";

// Must run after authMiddleware so req.user is populated.
const adminMiddleware = async (req, res, next) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export default adminMiddleware;
