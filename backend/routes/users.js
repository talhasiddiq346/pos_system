import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { friendlyPgError } from "../lib/pgErrors.js";

const router = Router();

const BRANCH_STAFF_ROLES = ["cashier", "chef", "delivery"];
const INDEPENDENT_ROLES = ["call_center"];

function validatePakistaniPhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  return /^03[0-9]{9}$/.test(cleaned) ||
         /^\+923[0-9]{9}$/.test(cleaned) ||
         /^923[0-9]{9}$/.test(cleaned);
}

router.post("/", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { name, email, password, role, branch_id, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  if (!validatePakistaniPhone(phone)) {
    return res.status(400).json({ error: "Valid Pakistani number required (e.g. 0300-1234567)" });
  }

  if (req.user.role === "branch_admin" && !BRANCH_STAFF_ROLES.includes(role)) {
    return res.status(403).json({ error: "Branch admins can only add cashier, chef or delivery staff" });
  }

  if (INDEPENDENT_ROLES.includes(role) && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Only a super admin can add call center staff" });
  }

  const finalBranchId = req.user.role === "branch_admin"
    ? req.user.branch_id
    : branch_id;

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "Email already exists" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, branch_id, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, branch_id, phone`,
      [name, email, hash, role, finalBranchId, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    const friendly = friendlyPgError(err);
    if (friendly) return res.status(friendly.status).json({ error: friendly.message });
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  let result;
  if (req.user.role === "super_admin") {
    result = await pool.query(
      "SELECT id, name, email, role, branch_id, phone FROM users ORDER BY id"
    );
  } else {
    result = await pool.query(
      "SELECT id, name, email, role, branch_id, phone FROM users WHERE branch_id = $1 ORDER BY id",
      [req.user.branch_id]
    );
  }
  res.json(result.rows);
});

router.patch("/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;

  if (!name || !email) return res.status(400).json({ error: "Name and email are required" });

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }
  if (!validatePakistaniPhone(phone)) {
    return res.status(400).json({ error: "Valid Pakistani number required (e.g. 0300-1234567)" });
  }

  const target = await pool.query("SELECT id, branch_id, role FROM users WHERE id = $1", [id]);
  if (target.rows.length === 0) return res.status(404).json({ error: "User not found" });
  const targetUser = target.rows[0];

  if (req.user.role === "branch_admin") {
    if (targetUser.branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: "You can only manage users in your own branch" });
    }
    if (["branch_admin", "super_admin"].includes(targetUser.role)) {
      return res.status(403).json({ error: "Admins cannot be edited from here" });
    }
  }

  const emailTaken = await pool.query(
    "SELECT id FROM users WHERE email = $1 AND id != $2",
    [email, id]
  );
  if (emailTaken.rows.length > 0) return res.status(409).json({ error: "Email already exists" });

  const result = await pool.query(
    `UPDATE users SET name = $1, email = $2, phone = $3
     WHERE id = $4
     RETURNING id, name, email, role, branch_id, phone`,
    [name, email, phone, id]
  );
  res.json(result.rows[0]);
});

router.patch("/:id/password", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const target = await pool.query("SELECT id, branch_id, role FROM users WHERE id = $1", [id]);
  if (target.rows.length === 0) return res.status(404).json({ error: "User not found" });
  const targetUser = target.rows[0];

  if (req.user.role === "branch_admin") {
    if (targetUser.branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: "You can only reset passwords within your own branch" });
    }
    if (["branch_admin", "super_admin"].includes(targetUser.role)) {
      return res.status(403).json({ error: "Admin passwords cannot be reset from here" });
    }
  }

  const hash = await bcrypt.hash(new_password, 10);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, id]);
  res.json({ ok: true });
});

router.delete("/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;

  const target = await pool.query("SELECT id, branch_id, role FROM users WHERE id = $1", [id]);
  if (target.rows.length === 0) return res.status(404).json({ error: "User not found" });
  const targetUser = target.rows[0];

  if (["branch_admin", "super_admin"].includes(targetUser.role)) {
    return res.status(409).json({
      error: "Branch admins can only be changed from the Branches tab, not removed directly.",
    });
  }

  if (req.user.role === "branch_admin" && targetUser.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage users in your own branch" });
  }

  if (BRANCH_STAFF_ROLES.includes(targetUser.role) && targetUser.branch_id !== null) {
    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM users WHERE branch_id = $1 AND role = $2",
      [targetUser.branch_id, targetUser.role]
    );
    if (countResult.rows[0].count <= 1) {
      return res.status(409).json({
        error: `This branch needs at least one ${targetUser.role}. Add another before removing this one.`,
      });
    }
  }

  if (targetUser.id === req.user.id) {
    return res.status(400).json({ error: "You cannot remove your own account" });
  }

  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  res.json({ ok: true });
});

export default router;