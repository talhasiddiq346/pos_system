import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

function parseRange(query) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  to.setHours(23, 59, 59, 999);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function previousRange(from, to) {
  const durationMs = to - from;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { prevFrom, prevTo };
}

// Builds branch + source filter clauses + params in one go.
// Returns { clause, params, nextIdx }
function buildFilters(user, query, from, to, opts = {}) {
  const { includeSource = true } = opts;
  const params = [from, to];
  let clause = "";
  let idx = 3;

  // Branch filter
  if (user.role === "branch_admin") {
    clause += ` AND o.branch_id = $${idx}`;
    params.push(user.branch_id);
    idx++;
  } else if (query.branch_id && query.branch_id !== "all") {
    clause += ` AND o.branch_id = $${idx}`;
    params.push(Number(query.branch_id));
    idx++;
  }

  // Source filter
  if (includeSource && query.source && query.source !== "all") {
    clause += ` AND o.source = $${idx}`;
    params.push(query.source);
    idx++;
  }

  return { clause, params, nextIdx: idx };
}

function growth(current, previous) {
  if (!previous || previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ============================================
// 1. OVERVIEW (stat cards)
// ============================================
router.get("/overview", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const { prevFrom, prevTo } = previousRange(from, to);

    const cur = buildFilters(req.user, req.query, from, to);
    const current = await pool.query(
      `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::float AS revenue,
              COALESCE(AVG(total), 0)::float AS avg_order
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 AND status != 'cancelled' ${cur.clause}`,
      cur.params
    );

    const prev = buildFilters(req.user, req.query, prevFrom, prevTo);
    const previous = await pool.query(
      `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::float AS revenue,
              COALESCE(AVG(total), 0)::float AS avg_order
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 AND status != 'cancelled' ${prev.clause}`,
      prev.params
    );

    let branchCount = 0;
    let staffCount = 0;
    if (req.user.role === "super_admin") {
      const bRes = await pool.query("SELECT COUNT(*)::int AS c FROM branches");
      branchCount = bRes.rows[0].c;
    } else {
      const sRes = await pool.query(
        `SELECT COUNT(*)::int AS c FROM users
         WHERE branch_id = $1 AND role IN ('cashier','chef','delivery')`,
        [req.user.branch_id]
      );
      staffCount = sRes.rows[0].c;
    }

    const c = current.rows[0];
    const p = previous.rows[0];

    res.json({
      revenue: { value: c.revenue, growth: growth(c.revenue, p.revenue) },
      orders: { value: c.orders, growth: growth(c.orders, p.orders) },
      avg_order: { value: c.avg_order, growth: growth(c.avg_order, p.avg_order) },
      branches: branchCount,
      active_staff: staffCount,
    });
  } catch (err) {
    console.error("Overview error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// DASHBOARD OVERVIEW (Overview panel — no source filter here)
// ============================================
router.get("/dashboard-overview", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const params = [sevenDaysAgo, now];
    let branchClauseStr = "";
    if (req.user.role === "branch_admin") {
      branchClauseStr = " AND o.branch_id = $3";
      params.push(req.user.branch_id);
    }

    const statsRes = await pool.query(
      `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::float AS revenue,
              COALESCE(AVG(total), 0)::float AS avg_order,
              COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 ${branchClauseStr}`,
      params
    );

    let secondary = { label: "Active Branches", value: 0 };
    if (req.user.role === "super_admin") {
      const bRes = await pool.query("SELECT COUNT(*)::int AS c FROM branches");
      secondary = { label: "Active Branches", value: bRes.rows[0].c };
    } else {
      const sRes = await pool.query(
        `SELECT COUNT(*)::int AS c FROM users
         WHERE branch_id = $1 AND role IN ('cashier','chef','delivery')`,
        [req.user.branch_id]
      );
      secondary = { label: "Active Staff", value: sRes.rows[0].c };
    }

    const trendRes = await pool.query(
      `SELECT date_trunc('day', created_at) AS day,
              COUNT(*)::int AS orders,
              COALESCE(SUM(total), 0)::float AS revenue
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 AND status != 'cancelled' ${branchClauseStr}
       GROUP BY day ORDER BY day`,
      params
    );

    const topItemsRes = await pool.query(
      `SELECT oi.product_name AS name,
              SUM(oi.quantity)::int AS orders,
              COALESCE(SUM(oi.line_total), 0)::float AS revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.created_at BETWEEN $1 AND $2 AND o.status != 'cancelled' ${branchClauseStr}
       GROUP BY oi.product_name
       ORDER BY orders DESC LIMIT 5`,
      params
    );

    let recentBranchClause = "";
    const recentParams = [];
    if (req.user.role === "branch_admin") {
      recentBranchClause = " WHERE o.branch_id = $1";
      recentParams.push(req.user.branch_id);
    }
    const recentRes = await pool.query(
      `SELECT o.id, o.order_code, o.total::float, o.status, o.source,
              o.customer_name, o.created_at, b.name AS branch_name
       FROM orders o
       LEFT JOIN branches b ON b.id = o.branch_id
       ${recentBranchClause}
       ORDER BY o.created_at DESC LIMIT 10`,
      recentParams
    );

    let alertBranchClause = "";
    const alertParams = [];
    if (req.user.role === "branch_admin") {
      alertBranchClause = " WHERE (branch_id = $1 OR scope = 'global') AND is_read = false";
      alertParams.push(req.user.branch_id);
    } else {
      alertBranchClause = " WHERE is_read = false";
    }
    let unreadAlerts = 0;
    try {
      const alertRes = await pool.query(
        `SELECT COUNT(*)::int AS c FROM alerts ${alertBranchClause}`,
        alertParams
      );
      unreadAlerts = alertRes.rows[0].c;
    } catch {
      // alerts table may not exist
    }

    const stats = statsRes.rows[0];
    res.json({
      stats: {
        revenue: stats.revenue,
        orders: stats.orders,
        avg_order: stats.avg_order,
        cancelled: stats.cancelled,
        secondary,
      },
      trend: trendRes.rows.map((r) => ({ day: r.day, orders: r.orders, revenue: r.revenue })),
      top_items: topItemsRes.rows,
      recent_orders: recentRes.rows,
      unread_alerts: unreadAlerts,
    });
  } catch (err) {
    console.error("Dashboard overview error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// 2. REVENUE TREND
// ============================================
router.get("/revenue-trend", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const durationDays = (to - from) / (1000 * 60 * 60 * 24);
    const groupBy = durationDays <= 2 ? "hour" : "day";

    const f = buildFilters(req.user, req.query, from, to);
    const truncFn = groupBy === "hour" ? "date_trunc('hour', created_at)" : "date_trunc('day', created_at)";

    const result = await pool.query(
      `SELECT ${truncFn} AS period,
              COUNT(*)::int AS orders,
              COALESCE(SUM(total), 0)::float AS revenue
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 AND status != 'cancelled' ${f.clause}
       GROUP BY period ORDER BY period`,
      f.params
    );

    res.json({
      groupBy,
      data: result.rows.map((r) => ({ period: r.period, orders: r.orders, revenue: r.revenue })),
    });
  } catch (err) {
    console.error("Revenue trend error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// 3. BY SOURCE (source filter NOT applied)
// ============================================
router.get("/by-source", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const f = buildFilters(req.user, req.query, from, to, { includeSource: false });

    const result = await pool.query(
      `SELECT source,
              COUNT(*)::int AS orders,
              COALESCE(SUM(total), 0)::float AS revenue,
              COALESCE(AVG(total), 0)::float AS avg_order,
              COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 ${f.clause}
       GROUP BY source ORDER BY revenue DESC`,
      f.params
    );

    res.json(result.rows.map((r) => ({
      source: r.source,
      orders: r.orders,
      revenue: r.revenue,
      avg_order: r.avg_order,
      cancelled: r.cancelled,
      cancel_rate: r.orders > 0 ? Math.round((r.cancelled / r.orders) * 100) : 0,
    })));
  } catch (err) {
    console.error("By source error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// 4. BY BRANCH
// ============================================
router.get("/by-branch", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);

    let sourceExtra = "";
    const params = [from, to];
    if (req.query.source && req.query.source !== "all") {
      sourceExtra = " AND o.source = $3";
      params.push(req.query.source);
    }

    const result = await pool.query(
      `SELECT b.id, b.name,
              COUNT(o.id)::int AS orders,
              COALESCE(SUM(o.total), 0)::float AS revenue,
              COALESCE(AVG(o.total), 0)::float AS avg_order,
              (SELECT oi.product_name FROM order_items oi
                JOIN orders o2 ON oi.order_id = o2.id
                WHERE o2.branch_id = b.id AND o2.created_at BETWEEN $1 AND $2
                  AND o2.status != 'cancelled'
                GROUP BY oi.product_name
                ORDER BY COUNT(*) DESC LIMIT 1) AS best_item
       FROM branches b
       LEFT JOIN orders o ON o.branch_id = b.id
         AND o.created_at BETWEEN $1 AND $2
         AND o.status != 'cancelled'
         ${sourceExtra}
       GROUP BY b.id, b.name ORDER BY revenue DESC`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("By branch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// 5. BEST SELLERS
// ============================================
router.get("/best-sellers", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const limit = Number(req.query.limit) || 10;
    const f = buildFilters(req.user, req.query, from, to);
    f.params.push(limit);
    const limitIdx = f.nextIdx;

    const result = await pool.query(
      `SELECT oi.product_name AS name,
              SUM(oi.quantity)::int AS orders,
              COALESCE(SUM(oi.line_total), 0)::float AS revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.created_at BETWEEN $1 AND $2 AND o.status != 'cancelled' ${f.clause}
       GROUP BY oi.product_name
       ORDER BY orders DESC LIMIT $${limitIdx}`,
      f.params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Best sellers error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// 6. BY CATEGORY
// ============================================
router.get("/by-category", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const f = buildFilters(req.user, req.query, from, to);

    const result = await pool.query(
      `SELECT COALESCE(p.category, 'Other') AS category,
              SUM(oi.quantity)::int AS orders,
              COALESCE(SUM(oi.line_total), 0)::float AS revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.created_at BETWEEN $1 AND $2 AND o.status != 'cancelled' ${f.clause}
       GROUP BY p.category ORDER BY revenue DESC`,
      f.params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("By category error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// 7. HOURLY HEATMAP
// ============================================
router.get("/hourly-heatmap", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const f = buildFilters(req.user, req.query, from, to);

    const result = await pool.query(
      `SELECT EXTRACT(DOW FROM created_at)::int AS dow,
              EXTRACT(HOUR FROM created_at)::int AS hour,
              COUNT(*)::int AS orders
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 AND status != 'cancelled' ${f.clause}
       GROUP BY dow, hour ORDER BY dow, hour`,
      f.params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Heatmap error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// 8. PAYMENT METHODS
// ============================================
router.get("/payment-methods", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const f = buildFilters(req.user, req.query, from, to);

    const result = await pool.query(
      `SELECT payment_method AS method,
              COUNT(*)::int AS orders,
              COALESCE(SUM(total), 0)::float AS revenue
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 AND status != 'cancelled' ${f.clause}
       GROUP BY payment_method`,
      f.params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Payment methods error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// 9. ORDER STATUS
// ============================================
router.get("/order-status", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const f = buildFilters(req.user, req.query, from, to);

    const result = await pool.query(
      `SELECT status, COUNT(*)::int AS orders
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 ${f.clause}
       GROUP BY status`,
      f.params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Order status error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// 10. STAFF PERFORMANCE (no source filter — role IS the filter)
// ============================================
router.get("/staff-performance", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const role = req.query.role || "cashier";

    const params = [from, to, role];
    let branchFilter = "";
    if (req.user.role === "branch_admin") {
      branchFilter = " AND u.branch_id = $4";
      params.push(req.user.branch_id);
    } else if (req.query.branch_id && req.query.branch_id !== "all") {
      branchFilter = " AND u.branch_id = $4";
      params.push(Number(req.query.branch_id));
    }

    let result;

    if (role === "cashier" || role === "call_center") {
      result = await pool.query(
        `SELECT u.id, u.name, u.branch_id, b.name AS branch_name,
                COUNT(o.id)::int AS orders,
                COALESCE(SUM(o.total), 0)::float AS revenue,
                COALESCE(AVG(o.total), 0)::float AS avg_order,
                COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int AS cancelled
         FROM users u
         LEFT JOIN branches b ON b.id = u.branch_id
         LEFT JOIN orders o ON o.created_by = u.id
           AND o.created_at BETWEEN $1 AND $2
         WHERE u.role = $3 ${branchFilter}
         GROUP BY u.id, u.name, u.branch_id, b.name
         ORDER BY revenue DESC`,
        params
      );
    } else if (role === "chef") {
      result = await pool.query(
        `SELECT u.id, u.name, u.branch_id, b.name AS branch_name,
                COUNT(o.id)::int AS orders,
                COUNT(o.id) FILTER (WHERE o.status IN ('ready','dispatched','delivered','completed'))::int AS prepared,
                COALESCE(SUM(o.total) FILTER (WHERE o.status != 'cancelled'), 0)::float AS revenue
         FROM users u
         LEFT JOIN branches b ON b.id = u.branch_id
         LEFT JOIN orders o ON o.branch_id = u.branch_id
           AND o.created_at BETWEEN $1 AND $2
         WHERE u.role = $3 ${branchFilter}
         GROUP BY u.id, u.name, u.branch_id, b.name
         ORDER BY prepared DESC`,
        params
      );
    } else if (role === "delivery") {
      result = await pool.query(
        `SELECT u.id, u.name, u.branch_id, b.name AS branch_name, u.rider_debt,
                COUNT(da.id)::int AS deliveries,
                COALESCE(AVG(EXTRACT(EPOCH FROM (da.delivered_at - da.accepted_at))/60), 0)::float AS avg_delivery_min,
                COALESCE(SUM(o.total) FILTER (WHERE o.payment_method = 'cash' AND da.delivered_at IS NOT NULL), 0)::float AS cash_collected
         FROM users u
         LEFT JOIN branches b ON b.id = u.branch_id
         LEFT JOIN delivery_assignments da ON da.rider_id = u.id
           AND da.assigned_at BETWEEN $1 AND $2
           AND da.status = 'accepted'
           AND da.delivered_at IS NOT NULL
         LEFT JOIN orders o ON o.id = da.order_id
         WHERE u.role = $3 ${branchFilter}
         GROUP BY u.id, u.name, u.branch_id, b.name, u.rider_debt
         ORDER BY deliveries DESC`,
        params
      );
    }

    res.json(result?.rows || []);
  } catch (err) {
    console.error("Staff performance error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;