import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Cash + performance report with date filter
router.get("/cash", requireAuth, requireRole("branch_admin", "super_admin"), async (req, res) => {
  const branchId = req.user.role === "super_admin"
    ? req.query.branch_id || null
    : req.user.branch_id;

  // Date filter — default today
  const { from, to } = req.query;
  const dateFrom = from || new Date().toISOString().split("T")[0];
  const dateTo = to || new Date().toISOString().split("T")[0];

  const branchFilter = branchId ? "WHERE b.id = $1" : "";
  const branchesRes = await pool.query(
    `SELECT b.id, b.name FROM branches b ${branchFilter} ORDER BY b.name`,
    branchId ? [branchId] : []
  );

  const report = [];

  for (const branch of branchesRes.rows) {
    // Cashiers — collections in date range
    const cashiersRes = await pool.query(
      `SELECT u.id, u.name,
         COALESCE(SUM(cs.amount_given) FILTER (
           WHERE cs.status = 'accepted'
             AND DATE(cs.accepted_at) BETWEEN $2 AND $3
         ), 0) AS collected,
         COUNT(cs.id) FILTER (
           WHERE cs.status = 'accepted'
             AND DATE(cs.accepted_at) BETWEEN $2 AND $3
         ) AS submissions
       FROM users u
       LEFT JOIN cash_submissions cs ON cs.cashier_id = u.id
       WHERE u.branch_id = $1 AND u.role = 'cashier'
       GROUP BY u.id, u.name
       ORDER BY u.name`,
      [branch.id, dateFrom, dateTo]
    );

    // Riders — performance in date range
    const ridersRes = await pool.query(
      `SELECT u.id, u.name, u.rider_debt, u.rider_status,
         COUNT(da.id) FILTER (
           WHERE da.status = 'delivered'
             AND DATE(da.delivered_at) BETWEEN $2 AND $3
         ) AS delivered_count,
         COUNT(da.id) FILTER (
           WHERE da.status = 'rejected'
             AND DATE(da.assigned_at) BETWEEN $2 AND $3
         ) AS rejected_count,
         COALESCE(AVG(
           EXTRACT(EPOCH FROM (da.delivered_at - da.accepted_at))/60
         ) FILTER (
           WHERE da.status = 'delivered'
             AND DATE(da.delivered_at) BETWEEN $2 AND $3
         ), 0) AS avg_delivery_time,
         COALESCE(SUM(o.total) FILTER (
           WHERE da.status = 'delivered'
             AND o.payment_method = 'cash'
             AND DATE(da.delivered_at) BETWEEN $2 AND $3
         ), 0) AS cash_collected
       FROM users u
       LEFT JOIN delivery_assignments da ON da.rider_id = u.id
       LEFT JOIN orders o ON o.id = da.order_id
       WHERE u.branch_id = $1 AND u.role = 'delivery'
       GROUP BY u.id, u.name, u.rider_debt, u.rider_status
       ORDER BY u.name`,
      [branch.id, dateFrom, dateTo]
    );

    report.push({
      branch_id: branch.id,
      branch_name: branch.name,
      cashiers: cashiersRes.rows,
      riders: ridersRes.rows.map((r) => ({
        ...r,
        avg_delivery_time: Math.round(Number(r.avg_delivery_time)),
        on_time_rate: r.delivered_count > 0
          ? Math.round((r.delivered_count / (Number(r.delivered_count) + Number(r.rejected_count))) * 100)
          : 100,
      })),
    });
  }

  res.json({ from: dateFrom, to: dateTo, report });
});

export default router;