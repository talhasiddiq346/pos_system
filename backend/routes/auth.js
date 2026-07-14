import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, loginSchema } from "../lib/validate.js";
import { cookieOptions, clearCookieOptions } from "../lib/cookies.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: "Invalid email or password" });

  const token = jwt.sign(
    { id: user.id, role: user.role, branch_id: user.branch_id, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  // ✅ Uses cookieOptions() — auto-switches secure + sameSite based on NODE_ENV
  res.cookie("token", token, cookieOptions());

  res.json({ id: user.id, name: user.name, role: user.role, branch_id: user.branch_id });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

router.post("/logout", (req, res) => {
  // ✅ MUST use same options as when setting — else browser won't clear cookie
  res.clearCookie("token", clearCookieOptions());
  res.json({ ok: true });
});

export default router;