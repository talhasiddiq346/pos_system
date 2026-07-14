import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { io } from "../server.js";
import { clearRiderTimer, startRiderTimer } from "../lib/riderTimers.js";
import { tryAssignRider } from "./orders.js";
import { validate, cashSubmissionSchema } from "../lib/validate.js";


const router = Router();

// Rider status update
router.patch("/status", requireAuth, requireRole("delivery"), async (req, res) => {
  const { status } = req.body;
  const allowed = ["available", "busy", "out_for_delivery", "offline"];
  if (!allowed.includes(status))
    return res.status(400).json({ error: "Invalid status" });

  if (status === "out_for_delivery") {
    const active = await pool.query(
      "SELECT COUNT(*) FROM delivery_assignments WHERE rider_id = $1 AND status = 'accepted'",
      [req.user.id]
    );
    if (parseInt(active.rows[0].count) === 0)
      return res.status(400).json({ error: "No accepted orders to deliver" });
    clearRiderTimer(req.user.id);
  }

  await pool.query("UPDATE users SET rider_status = $1 WHERE id = $2", [status, req.user.id]);

  if (req.user.branch_id) {
    io.to(`branch_${req.user.branch_id}_branch_admin`).emit("rider_status_changed", {
      rider_id: req.user.id, status,
    });
  }

  if (status === "available" && req.user.branch_id) {
    setTimeout(async () => {
      const waiting = await pool.query(
        `SELECT id FROM orders
         WHERE branch_id = $1 AND order_type = 'delivery' AND status = 'ready'
           AND id NOT IN (
             SELECT order_id FROM delivery_assignments WHERE status IN ('pending','accepted')
           )
         ORDER BY created_at ASC LIMIT 1`,
        [req.user.branch_id]
      );
      if (waiting.rows.length > 0) {
        io.to(`rider_${req.user.id}`).emit("waiting_order_available", {
          order_id: waiting.rows[0].id,
          message: "A waiting order is available for pickup!",
        });
      }
    }, 300);
  }

  res.json({ ok: true, status });
});

// Waiting orders — rider khud accept kare
router.get("/waiting-orders", requireAuth, requireRole("delivery"), async (req, res) => {
  const result = await pool.query(
    `SELECT o.*, oi_agg.items
     FROM orders o
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'name', product_name, 'variant', variant_name, 'qty', quantity
       )) AS items
       FROM order_items WHERE order_id = o.id
     ) oi_agg ON true
     WHERE o.branch_id = $1
       AND o.order_type = 'delivery'
       AND o.status = 'ready'
       AND o.id NOT IN (
         SELECT order_id FROM delivery_assignments WHERE status IN ('pending','accepted')
       )
     ORDER BY o.created_at ASC`,
    [req.user.branch_id]
  );
  res.json(result.rows);
});

// Rider khud waiting order accept kare
router.post("/waiting-orders/:orderId/accept", requireAuth, requireRole("delivery"), async (req, res) => {
  const { orderId } = req.params;

  const activeCount = await pool.query(
    "SELECT COUNT(*) FROM delivery_assignments WHERE rider_id = $1 AND status = 'accepted'",
    [req.user.id]
  );
  if (parseInt(activeCount.rows[0].count) >= 5)
    return res.status(409).json({ error: "You already have 5 orders" });

  const existing = await pool.query(
    "SELECT id FROM delivery_assignments WHERE order_id = $1 AND status IN ('pending','accepted')",
    [orderId]
  );
  if (existing.rows.length > 0)
    return res.status(409).json({ error: "Order already taken by another rider" });

  const orderRes = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
  if (orderRes.rows.length === 0)
    return res.status(404).json({ error: "Order not found" });
  const order = orderRes.rows[0];

  await pool.query(
    `INSERT INTO delivery_assignments (order_id, rider_id, attempt, status, accepted_at, trip_started_at)
     VALUES ($1, $2, 1, 'accepted', NOW(), NOW())`,
    [orderId, req.user.id]
  );

  await pool.query("UPDATE orders SET status = 'dispatched' WHERE id = $1", [orderId]);

  await pool.query(
    "UPDATE users SET rider_status = 'busy' WHERE id = $1 AND rider_status IN ('available', 'offline')",
    [req.user.id]
  );

  startRiderTimer(req.user.id, req.user.branch_id);

  io.to(`branch_${order.branch_id}_chef`).emit("waiting_order_accepted", {
    order_id: parseInt(orderId),
    rider_name: req.user.name,
  });

  res.json({ ok: true });
});

// My active orders
router.get("/my-orders", requireAuth, requireRole("delivery"), async (req, res) => {
  const result = await pool.query(
    `SELECT da.*, o.customer_name, o.customer_phone,
            o.customer_address, o.total, o.source,
            o.payment_method, o.created_at AS order_time,
            oi_agg.items
     FROM delivery_assignments da
     JOIN orders o ON o.id = da.order_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'name', product_name, 'variant', variant_name, 'qty', quantity
       )) AS items
       FROM order_items WHERE order_id = o.id
     ) oi_agg ON true
     WHERE da.rider_id = $1 AND da.status = 'accepted'
     ORDER BY da.accepted_at ASC`,
    [req.user.id]
  );
  res.json(result.rows);
});

// Mark delivered
router.patch("/assignments/:id/delivered", requireAuth, requireRole("delivery"), async (req, res) => {
  const { id } = req.params;

  const assignmentResult = await pool.query(
    "SELECT * FROM delivery_assignments WHERE id = $1 AND rider_id = $2 AND status = 'accepted'",
    [id, req.user.id]
  );
  if (assignmentResult.rows.length === 0)
    return res.status(404).json({ error: "Assignment not found" });

  const assignment = assignmentResult.rows[0];

  await pool.query(
    "UPDATE delivery_assignments SET status = 'delivered', delivered_at = NOW() WHERE id = $1",
    [id]
  );
  await pool.query("UPDATE orders SET status = 'delivered' WHERE id = $1", [assignment.order_id]);

  const remaining = await pool.query(
    "SELECT COUNT(*) FROM delivery_assignments WHERE rider_id = $1 AND status = 'accepted'",
    [req.user.id]
  );
  if (parseInt(remaining.rows[0].count) === 0) {
    await pool.query("UPDATE users SET rider_status = 'available' WHERE id = $1", [req.user.id]);
    io.to(`rider_${req.user.id}`).emit("trip_complete", {
      message: "All orders delivered! Submit your cash to the cashier.",
    });
  }

  res.json({ ok: true });
});

// Cash summary
// Cash summary — double count fix
// previousDebt = sirf kal ka/purana (DB value, din ke beech nahi badlta)
// totalGivenToday = aaj accepted submissions
// remaining = (aaj ka cash + purana debt) - aaj diya
router.get("/cash-summary", requireAuth, requireRole("delivery"), async (req, res) => {
  const deliveredRes = await pool.query(
    `SELECT da.id AS assignment_id, o.id AS order_id,
            o.customer_name, o.customer_address, o.total,
            o.payment_method, da.delivered_at
     FROM delivery_assignments da
     JOIN orders o ON o.id = da.order_id
     WHERE da.rider_id = $1
       AND da.status = 'delivered'
       AND DATE(da.delivered_at) = CURRENT_DATE
     ORDER BY da.delivered_at DESC`,
    [req.user.id]
  );

  const riderRes = await pool.query(
    "SELECT rider_debt FROM users WHERE id = $1",
    [req.user.id]
  );

  const cashOrders = deliveredRes.rows.filter((o) => o.payment_method === "cash");
  const totalCashToday = cashOrders.reduce((sum, o) => sum + Number(o.total), 0);

  // previousDebt = jo kal se carry hua tha (din shuru mein DB mein tha)
  // Yeh din ke beech mein nahi badlta ab
  const previousDebt = Number(riderRes.rows[0]?.rider_debt || 0);

  // Aaj jo accepted submissions hain
  const submittedRes = await pool.query(
    `SELECT COALESCE(SUM(amount_given), 0) AS total_given
     FROM cash_submissions
     WHERE rider_id = $1
       AND DATE(submitted_at) = CURRENT_DATE
       AND status = 'accepted'`,
    [req.user.id]
  );
  const totalGivenToday = Number(submittedRes.rows[0]?.total_given || 0);

  // Sahi calculation — no double count
  const totalOwed = totalCashToday + previousDebt;
  const remainingOwed = Math.max(0, totalOwed - totalGivenToday);

  res.json({
    delivered_orders: deliveredRes.rows,
    cash_orders: cashOrders,
    total_cash_collected: totalCashToday,
    previous_debt: previousDebt,
    total_owed: totalOwed,
    total_given_today: totalGivenToday,
    remaining_owed: remainingOwed,
  });
});

// Submit cash
router.post("/cash-submission", requireAuth, requireRole("delivery"), async (req, res) => {
  const { cashier_id, amount_given } = validate(cashSubmissionSchema, req.body);
  if (!cashier_id || amount_given === undefined)
    return res.status(400).json({ error: "cashier_id and amount_given are required" });

  const riderRes = await pool.query("SELECT rider_debt, branch_id FROM users WHERE id = $1", [req.user.id]);
  const rider = riderRes.rows[0];
  // Check karo pending submission pehle se hai ya nahi
const pendingCheck = await pool.query(
  `SELECT id FROM cash_submissions 
   WHERE rider_id = $1 AND status = 'pending'`,
  [req.user.id]
);
if (pendingCheck.rows.length > 0) {
  return res.status(409).json({ 
    error: "You already have a pending submission. Wait for cashier to accept it first." 
  });
}

  const cashRes = await pool.query(
    `SELECT COALESCE(SUM(o.total), 0) AS total_cash
     FROM delivery_assignments da
     JOIN orders o ON o.id = da.order_id
     WHERE da.rider_id = $1 AND da.status = 'delivered'
       AND o.payment_method = 'cash' AND DATE(da.delivered_at) = CURRENT_DATE`,
    [req.user.id]
  );

  const submittedRes = await pool.query(
    `SELECT COALESCE(SUM(amount_given), 0) AS total_given
     FROM cash_submissions
     WHERE rider_id = $1 AND DATE(submitted_at) = CURRENT_DATE AND status = 'accepted'`,
    [req.user.id]
  );

  const totalCash = Number(cashRes.rows[0].total_cash);
  const previousDebt = Number(rider.rider_debt);
  const totalOwed = totalCash + previousDebt - Number(submittedRes.rows[0].total_given);

  const given = Number(amount_given);
  if (given > totalOwed)
    return res.status(400).json({ error: `Amount cannot exceed total owed (Rs ${totalOwed.toFixed(2)})` });
  if (given <= 0)
    return res.status(400).json({ error: "Amount must be greater than 0" });

  const cashierRes = await pool.query(
    "SELECT id FROM users WHERE id = $1 AND role = 'cashier' AND branch_id = $2",
    [cashier_id, rider.branch_id]
  );
  if (cashierRes.rows.length === 0)
    return res.status(404).json({ error: "Cashier not found in your branch" });

  const submission = await pool.query(
    `INSERT INTO cash_submissions
       (rider_id, cashier_id, branch_id, total_owed, amount_given, debt_carried)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user.id, cashier_id, rider.branch_id, totalOwed, given, Math.max(0, totalOwed - given)]
  );

  io.to(`cashier_${cashier_id}`).emit("cash_submission", {
    submission_id: submission.rows[0].id,
    rider_id: req.user.id,
    amount_given: given,
  });

  res.status(201).json(submission.rows[0]);
});

// Today's history — with delivery time
router.get("/today", requireAuth, requireRole("delivery"), async (req, res) => {
  const result = await pool.query(
    `SELECT 
       da.id, da.order_id, da.status,
       da.assigned_at, da.accepted_at, da.delivered_at,
       EXTRACT(EPOCH FROM (da.delivered_at - da.accepted_at))/60 AS delivery_minutes,
       o.customer_name, o.customer_address, o.customer_phone,
       o.total, o.payment_method, o.source, o.order_type
     FROM delivery_assignments da
     JOIN orders o ON o.id = da.order_id
     WHERE da.rider_id = $1 AND DATE(da.assigned_at) = CURRENT_DATE
     ORDER BY da.assigned_at DESC`,
    [req.user.id]
  );

  const riderRes = await pool.query("SELECT rider_debt FROM users WHERE id = $1", [req.user.id]);

  // Cash submissions history
  const submissionsRes = await pool.query(
    `SELECT cs.*, u.name AS cashier_name
     FROM cash_submissions cs
     JOIN users u ON u.id = cs.cashier_id
     WHERE cs.rider_id = $1 AND DATE(cs.submitted_at) = CURRENT_DATE
     ORDER BY cs.submitted_at DESC`,
    [req.user.id]
  );

  const delivered = result.rows.filter((r) => r.status === "delivered");
  const rejected  = result.rows.filter((r) => r.status === "rejected").length;
  const active    = result.rows.filter((r) => r.status === "accepted").length;
  const cashOrders = delivered.filter((r) => r.payment_method === "cash");
  const cardOrders = delivered.filter((r) => r.payment_method === "card");
  const totalCash = cashOrders.reduce((sum, r) => sum + Number(r.total), 0);
  const deliveryTimes = delivered.filter((r) => r.delivery_minutes != null).map((r) => Number(r.delivery_minutes));
  const avgDeliveryTime = deliveryTimes.length
    ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length : 0;

  res.json({
    orders: result.rows,
    submissions: submissionsRes.rows,
    summary: {
      total: delivered.length + active,
      delivered: delivered.length,
      rejected, active,
      cash_orders: cashOrders.length,
      card_orders: cardOrders.length,
      total_cash: totalCash,
      avg_delivery_time: Math.round(avgDeliveryTime),
      current_debt: Number(riderRes.rows[0]?.rider_debt || 0),
    },
  });
});
// Branch cashiers for dropdown
router.get("/cashiers", requireAuth, requireRole("delivery"), async (req, res) => {
  const result = await pool.query(
    "SELECT id, name FROM users WHERE branch_id = $1 AND role = 'cashier' ORDER BY name",
    [req.user.branch_id]
  );
  res.json(result.rows);
});

// Riders list for chef assignment
router.get("/branch-riders", requireAuth, requireRole("chef", "branch_admin", "super_admin"), async (req, res) => {
  const branchId = req.user.role === "super_admin" ? req.query.branch_id : req.user.branch_id;
  if (!branchId) return res.status(400).json({ error: "Branch required" });

  const result = await pool.query(
    `SELECT u.id, u.name, u.rider_status,
       COUNT(da.id) FILTER (WHERE da.status = 'accepted') AS active_orders
     FROM users u
     LEFT JOIN delivery_assignments da ON da.rider_id = u.id
     WHERE u.branch_id = $1 AND u.role = 'delivery'
     GROUP BY u.id, u.name, u.rider_status
     ORDER BY u.name`,
    [branchId]
  );
  res.json(result.rows);
});

export default router;