import jwt from "jsonwebtoken";

const {verify} = jwt;

const authMiddleware = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const user = verify(token,process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;