import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { io } from "../server.js";

const router = Router();

// GET alerts (per user role)
router.get("/", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    let result;
    if (req.user.role === "super_admin") {
      result = await pool.query(
        `SELECT a.*, b.name AS branch_name
         FROM alerts a LEFT JOIN branches b ON a.branch_id = b.id
         ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
    } else {
      result = await pool.query(
        `SELECT a.*, b.name AS branch_name
         FROM alerts a LEFT JOIN branches b ON a.branch_id = b.id
         WHERE a.scope = 'global' OR a.branch_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [req.user.branch_id, limit]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error("Get alerts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Mark alert as read
router.patch("/:id/read", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    await pool.query("UPDATE alerts SET is_read = true WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Mark all as read
router.patch("/read-all", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    if (req.user.role === "super_admin") {
      await pool.query("UPDATE alerts SET is_read = true WHERE is_read = false");
    } else {
      await pool.query(
        "UPDATE alerts SET is_read = true WHERE is_read = false AND (scope = 'global' OR branch_id = $1)",
        [req.user.branch_id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Unread count
router.get("/unread-count", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    let result;
    if (req.user.role === "super_admin") {
      result = await pool.query("SELECT COUNT(*)::int AS c FROM alerts WHERE is_read = false");
    } else {
      result = await pool.query(
        "SELECT COUNT(*)::int AS c FROM alerts WHERE is_read = false AND (scope = 'global' OR branch_id = $1)",
        [req.user.branch_id]
      );
    }
    res.json({ count: result.rows[0].c });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Helper: create alert & emit socket event
export async function createAlert({ branch_id, type, title, message, icon, scope = "branch", metadata }) {
  const result = await pool.query(
    `INSERT INTO alerts (branch_id, type, title, message, icon, scope, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [branch_id, type, title, message, icon || null, scope, metadata || null]
  );
  const alert = result.rows[0];

  // Emit to appropriate rooms
  if (scope === "global") {
    io.emit("new_alert", alert);
  } else if (branch_id) {
    io.to(`branch_${branch_id}`).emit("new_alert", alert);
    io.emit("new_alert", alert); // super_admin also receives
  }

  return alert;
}

// Trigger check — called from cron / on order events
export async function checkAlerts() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Revenue milestone (per branch)
    const branches = await pool.query("SELECT id, name FROM branches");
    for (const b of branches.rows) {
      const rev = await pool.query(
        `SELECT COALESCE(SUM(total), 0)::float AS r, COUNT(*)::int AS c
         FROM orders WHERE branch_id = $1 AND created_at >= $2 AND status != 'cancelled'`,
        [b.id, today]
      );
      const revenue = rev.rows[0].r;
      const count = rev.rows[0].c;

      // Milestone check
      const milestones = [50000, 100000, 200000, 500000];
      for (const m of milestones) {
        if (revenue >= m) {
          const already = await pool.query(
            `SELECT id FROM alerts WHERE branch_id = $1 AND type = 'positive'
             AND metadata->>'milestone' = $2 AND created_at >= $3`,
            [b.id, String(m), today]
          );
          if (already.rows.length === 0) {
            await createAlert({
              branch_id: b.id,
              type: "positive",
              title: `${b.name} hit Rs ${m.toLocaleString()} milestone!`,
              message: `${count} orders today`,
              icon: "🎉",
              metadata: { milestone: m },
            });
          }
        }
      }

      // Cancellation rate check
      const cancelRes = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                COUNT(*)::int AS total
         FROM orders WHERE branch_id = $1 AND created_at >= $2`,
        [b.id, today]
      );
      const { cancelled, total } = cancelRes.rows[0];
      if (total >= 10 && (cancelled / total) > 0.08) {
        const already = await pool.query(
          `SELECT id FROM alerts WHERE branch_id = $1 AND type = 'warning'
           AND metadata->>'kind' = 'cancellation_high' AND created_at >= $2`,
          [b.id, today]
        );
        if (already.rows.length === 0) {
          await createAlert({
            branch_id: b.id,
            type: "warning",
            title: `${b.name}: High cancellation rate`,
            message: `${Math.round((cancelled/total)*100)}% cancellation today (avg is 3%)`,
            icon: "⚠️",
            metadata: { kind: "cancellation_high" },
          });
        }
      }
    }

    // Rider debt check (global for super_admin)
    const debts = await pool.query(
      "SELECT id, name, rider_debt FROM users WHERE role = 'delivery' AND rider_debt > 10000"
    );
    for (const d of debts.rows) {
      const already = await pool.query(
        `SELECT id FROM alerts WHERE type = 'warning'
         AND metadata->>'kind' = 'rider_debt'
         AND metadata->>'rider_id' = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
        [String(d.id)]
      );
      if (already.rows.length === 0) {
        await createAlert({
          scope: "global",
          type: "warning",
          title: `${d.name} has Rs ${Math.round(d.rider_debt).toLocaleString()} debt`,
          message: "Settle debts soon",
          icon: "💰",
          metadata: { kind: "rider_debt", rider_id: d.id },
        });
      }
    }
  } catch (err) {
    console.error("checkAlerts error:", err);
  }
}

// Manual trigger endpoint (for testing)
router.post("/trigger-check", requireAuth, requireRole("super_admin"), async (req, res) => {
  await checkAlerts();
  res.json({ ok: true });
});

export default router;