import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { io } from "../server.js";

const router = Router();

// Cash submissions — cashier ka aaj ka
router.get("/submissions", requireAuth, requireRole("cashier", "branch_admin", "super_admin"), async (req, res) => {
  let query, params;

  if (req.user.role === "cashier") {
    query = `
      SELECT cs.*,
        u.name AS rider_name,
        (
          SELECT COUNT(*) FROM delivery_assignments da
          JOIN orders o ON o.id = da.order_id
          WHERE da.rider_id = cs.rider_id
            AND da.status = 'delivered'
            AND DATE(da.delivered_at) = CURRENT_DATE
        ) AS deliveries_today,
        (
          SELECT COALESCE(SUM(o.total), 0)
          FROM delivery_assignments da
          JOIN orders o ON o.id = da.order_id
          WHERE da.rider_id = cs.rider_id
            AND da.status = 'delivered'
            AND o.payment_method = 'cash'
            AND DATE(da.delivered_at) = CURRENT_DATE
        ) AS total_cash_today
      FROM cash_submissions cs
      JOIN users u ON u.id = cs.rider_id
      WHERE cs.cashier_id = $1
        AND DATE(cs.submitted_at) = CURRENT_DATE
      ORDER BY cs.submitted_at DESC
    `;
    params = [req.user.id];
  } else if (req.user.role === "branch_admin") {
    query = `
      SELECT cs.*,
        u.name AS rider_name,
        c.name AS cashier_name
      FROM cash_submissions cs
      JOIN users u ON u.id = cs.rider_id
      JOIN users c ON c.id = cs.cashier_id
      WHERE cs.branch_id = $1
        AND DATE(cs.submitted_at) = CURRENT_DATE
      ORDER BY cs.submitted_at DESC
    `;
    params = [req.user.branch_id];
  } else {
    const branchId = req.query.branch_id;
    query = `
      SELECT cs.*,
        u.name AS rider_name,
        c.name AS cashier_name,
        b.name AS branch_name
      FROM cash_submissions cs
      JOIN users u ON u.id = cs.rider_id
      JOIN users c ON c.id = cs.cashier_id
      JOIN branches b ON b.id = cs.branch_id
      ${branchId ? "WHERE cs.branch_id = $1 AND DATE(cs.submitted_at) = CURRENT_DATE" : "WHERE DATE(cs.submitted_at) = CURRENT_DATE"}
      ORDER BY cs.submitted_at DESC
    `;
    params = branchId ? [branchId] : [];
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Accept submission
router.patch("/submissions/:id/accept", requireAuth, requireRole("cashier"), async (req, res) => {
  const { id } = req.params;

  const subResult = await pool.query(
    "SELECT * FROM cash_submissions WHERE id = $1 AND cashier_id = $2 AND status = 'pending'",
    [id, req.user.id]
  );
  if (subResult.rows.length === 0)
    return res.status(404).json({ error: "Submission not found or already accepted" });

  const sub = subResult.rows[0];

  // Sirf accepted mark karo — rider_debt din ke beech mein mat chhuo
  // Din ke end mein branch admin "Settle" karega
  await pool.query(
    "UPDATE cash_submissions SET status = 'accepted', accepted_at = NOW() WHERE id = $1",
    [id]
  );

  // Rider ko notify karo
  io.to(`rider_${sub.rider_id}`).emit("cash_accepted", {
    amount_given: sub.amount_given,
    debt_remaining: Number(sub.debt_carried),
  });

  res.json({ ok: true });
});

// Settle debts — branch admin din ke end mein chalaye
// Har rider ka remaining calculate karke rider_debt update karo
router.post("/settle-debts", requireAuth, requireRole("branch_admin", "super_admin"), async (req, res) => {
  const branchId = req.user.role === "super_admin"
    ? req.body.branch_id
    : req.user.branch_id;

  if (!branchId)
    return res.status(400).json({ error: "Branch required" });

  const riders = await pool.query(
    "SELECT id, rider_debt FROM users WHERE role = 'delivery' AND branch_id = $1",
    [branchId]
  );

  const results = [];

  for (const rider of riders.rows) {
    // Aaj ka cash collected
    const cashRes = await pool.query(
      `SELECT COALESCE(SUM(o.total), 0) AS total
       FROM delivery_assignments da
       JOIN orders o ON o.id = da.order_id
       WHERE da.rider_id = $1
         AND da.status = 'delivered'
         AND o.payment_method = 'cash'
         AND DATE(da.delivered_at) = CURRENT_DATE`,
      [rider.id]
    );

    // Aaj submitted + accepted
    const submittedRes = await pool.query(
      `SELECT COALESCE(SUM(amount_given), 0) AS total_given
       FROM cash_submissions
       WHERE rider_id = $1
         AND DATE(submitted_at) = CURRENT_DATE
         AND status = 'accepted'`,
      [rider.id]
    );

    const todayCash = Number(cashRes.rows[0].total);
    const previousDebt = Number(rider.rider_debt);
    const totalGiven = Number(submittedRes.rows[0].total_given);

    // New debt = (aaj ka cash + purana debt) - aaj diya hua
    const newDebt = Math.max(0, todayCash + previousDebt - totalGiven);

    await pool.query(
      "UPDATE users SET rider_debt = $1 WHERE id = $2",
      [newDebt, rider.id]
    );

    results.push({ rider_id: rider.id, new_debt: newDebt });
  }

  res.json({ ok: true, results });
});

export default router;