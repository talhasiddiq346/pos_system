import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { friendlyPgError } from "../lib/pgErrors.js";

const router = Router();

const STAFF_ROLES = ["cashier", "chef"];

async function assignPerson(client, personSpec, role, branchId) {
  if (personSpec?.mode === "new") {
    const { name, email, password } = personSpec;
    if (!name || !email || !password) {
      throw { status: 400, message: `Name, email and password are required for the new ${role.replace("_", " ")}` };
    }

    const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      throw { status: 409, message: `Email already exists: ${email}` };
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, role, branch_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, branch_id`,
      [name, email, hash, role, branchId]
    );
    return result.rows[0];
  }

  if (personSpec?.mode === "existing") {
    const { user_id } = personSpec;
    if (!user_id) throw { status: 400, message: `Select an existing user for the ${role.replace("_", " ")} role` };

    const result = await client.query(
      `UPDATE users SET role = $1, branch_id = $2 WHERE id = $3
       RETURNING id, name, email, role, branch_id`,
      [role, branchId, user_id]
    );
    if (result.rows.length === 0) throw { status: 404, message: "User not found" };
    return result.rows[0];
  }

  throw { status: 400, message: `Invalid assignment for ${role.replace("_", " ")}` };
}

async function handleRouteError(client, err, res) {
  await client.query("ROLLBACK");
  const friendly = friendlyPgError(err);
  if (friendly) return res.status(friendly.status).json({ error: friendly.message });
  res.status(err.status || 500).json({ error: err.message || "Server error" });
}

router.get("/", requireAuth, requireRole("super_admin","call_center"), async (req, res) => {
  const result = await pool.query("SELECT * FROM branches ORDER BY id");
  res.json(result.rows);
});

router.post("/", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { name, address, admin, staff } = req.body;

  if (!name) return res.status(400).json({ error: "Branch name is required" });
  if (!admin) return res.status(400).json({ error: "Branch admin is required" });

  const staffList = Array.isArray(staff) ? staff : [];

  for (const s of staffList) {
    if (!STAFF_ROLES.includes(s.role)) {
      return res.status(400).json({ error: `Invalid staff role: ${s.role}` });
    }
  }

  const hasCashier = staffList.some((s) => s.role === "cashier");
  const hasChef = staffList.some((s) => s.role === "chef");

  if (!hasCashier || !hasChef) {
    return res.status(400).json({ error: "A cashier and a chef are both required to create a branch" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const branchResult = await client.query(
      "INSERT INTO branches (name, address) VALUES ($1, $2) RETURNING *",
      [name, address || null]
    );
    const branch = branchResult.rows[0];

    const adminUser = await assignPerson(client, admin, "branch_admin", branch.id);

    const staffUsers = [];
    for (const s of staffList) {
      const person = await assignPerson(client, s, s.role, branch.id);
      staffUsers.push(person);
    }

    await client.query("COMMIT");
    res.status(201).json({ branch, admin: adminUser, staff: staffUsers });
  } catch (err) {
    await handleRouteError(client, err, res);
  } finally {
    client.release();
  }
});

router.patch("/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { id } = req.params;
  const { name, address } = req.body;
  if (!name) return res.status(400).json({ error: "Branch name is required" });

  const result = await pool.query(
    "UPDATE branches SET name = $1, address = $2 WHERE id = $3 RETURNING *",
    [name, address || null, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Branch not found" });

  res.json(result.rows[0]);
});

// Clear every current admin on this branch FIRST, then assign the new one.
// Both happen in one transaction — if assignment fails, the rollback
// restores the original admin, so the branch is never seen without one.
router.patch("/:id/admin", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { id } = req.params;
  const { admin } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const branchCheck = await client.query("SELECT * FROM branches WHERE id = $1", [id]);
    if (branchCheck.rows.length === 0) throw { status: 404, message: "Branch not found" };

    await client.query(
      "UPDATE users SET branch_id = NULL WHERE branch_id = $1 AND role = 'branch_admin'",
      [id]
    );

    const newAdmin = await assignPerson(client, admin, "branch_admin", id);

    await client.query("COMMIT");
    res.json({ admin: newAdmin });
  } catch (err) {
    await handleRouteError(client, err, res);
  } finally {
    client.release();
  }
});
router.get("/me", requireAuth, async (req, res) => {
  if (!req.user.branch_id) return res.status(404).json({ error: "No branch assigned" });
  const result = await pool.query("SELECT * FROM branches WHERE id = $1", [req.user.branch_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Branch not found" });
  res.json(result.rows[0]);
});

// Deleting a branch unassigns everyone working there instead of blocking —
// they all land in the Unassigned pool and can be reassigned or deleted.
router.delete("/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const branchCheck = await client.query("SELECT * FROM branches WHERE id = $1", [id]);
    if (branchCheck.rows.length === 0) throw { status: 404, message: "Branch not found" };

    await client.query("UPDATE users SET branch_id = NULL WHERE branch_id = $1", [id]);
    const result = await client.query("DELETE FROM branches WHERE id = $1 RETURNING *", [id]);

    await client.query("COMMIT");
    res.json({ ok: true, deleted: result.rows[0] });
  } catch (err) {
    await handleRouteError(client, err, res);
  } finally {
    client.release();
  }
});

export default router;