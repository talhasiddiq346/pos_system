import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Login required" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Not allowed for your role" });
    }
    next();
  };
}