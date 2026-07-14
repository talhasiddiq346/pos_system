import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import PDFDocument from "pdfkit";

const router = Router();

// Helper: fetch report data
async function fetchReportData(type, user, query) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  to.setHours(23, 59, 59, 999);
  from.setHours(0, 0, 0, 0);

  const params = [from, to];
  let branchClause = "";
  if (user.role === "branch_admin") {
    branchClause = " AND o.branch_id = $3";
    params.push(user.branch_id);
  } else if (query.branch_id && query.branch_id !== "all") {
    branchClause = " AND o.branch_id = $3";
    params.push(Number(query.branch_id));
  }

  const data = { from, to, type };

  // Overview
  const overview = await pool.query(
    `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::float AS revenue,
            COALESCE(AVG(total), 0)::float AS avg_order,
            COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
     FROM orders o
     WHERE created_at BETWEEN $1 AND $2 ${branchClause}`,
    params
  );
  data.overview = overview.rows[0];

  // Branch info
  if (params.length === 3) {
    const branchRes = await pool.query("SELECT name FROM branches WHERE id = $1", [params[2]]);
    data.branch_name = branchRes.rows[0]?.name || "Unknown";
  } else {
    data.branch_name = "All Branches";
  }

  if (type === "business" || type === "branch") {
    // Sources breakdown
    data.sources = (await pool.query(
      `SELECT source, COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::float AS revenue,
              COALESCE(AVG(total), 0)::float AS avg_order
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 AND status != 'cancelled' ${branchClause}
       GROUP BY source ORDER BY revenue DESC`,
      params
    )).rows;

    // Best sellers
    data.best_sellers = (await pool.query(
      `SELECT oi.product_name AS name, SUM(oi.quantity)::int AS orders,
              COALESCE(SUM(oi.line_total), 0)::float AS revenue
       FROM order_items oi JOIN orders o ON oi.order_id = o.id
       WHERE o.created_at BETWEEN $1 AND $2 AND o.status != 'cancelled' ${branchClause}
       GROUP BY oi.product_name ORDER BY orders DESC LIMIT 10`,
      params
    )).rows;

    // Categories
    data.categories = (await pool.query(
      `SELECT COALESCE(p.category, 'Other') AS category,
              SUM(oi.quantity)::int AS orders,
              COALESCE(SUM(oi.line_total), 0)::float AS revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.created_at BETWEEN $1 AND $2 AND o.status != 'cancelled' ${branchClause}
       GROUP BY p.category ORDER BY revenue DESC`,
      params
    )).rows;

    // Payment methods
    data.payments = (await pool.query(
      `SELECT payment_method AS method, COUNT(*)::int AS orders,
              COALESCE(SUM(total), 0)::float AS revenue
       FROM orders o
       WHERE created_at BETWEEN $1 AND $2 AND status != 'cancelled' ${branchClause}
       GROUP BY payment_method`,
      params
    )).rows;
  }

  if (type === "business" && user.role === "super_admin") {
    // Branches comparison
    data.branches = (await pool.query(
      `SELECT b.name, COUNT(o.id)::int AS orders,
              COALESCE(SUM(o.total), 0)::float AS revenue,
              COALESCE(AVG(o.total), 0)::float AS avg_order
       FROM branches b
       LEFT JOIN orders o ON o.branch_id = b.id AND o.created_at BETWEEN $1 AND $2 AND o.status != 'cancelled'
       GROUP BY b.id, b.name ORDER BY revenue DESC`,
      [from, to]
    )).rows;
  }

  if (type === "staff") {
    const role = query.staff_role || "cashier";
    data.staff_role = role;
    let staffQuery;
    if (role === "delivery") {
      staffQuery = `SELECT u.name, u.rider_debt,
        COUNT(da.id)::int AS deliveries,
        COALESCE(AVG(EXTRACT(EPOCH FROM (da.delivered_at - da.accepted_at))/60), 0)::float AS avg_delivery_min
        FROM users u
        LEFT JOIN delivery_assignments da ON da.rider_id = u.id
          AND da.assigned_at BETWEEN $1 AND $2 AND da.status = 'accepted' AND da.delivered_at IS NOT NULL
        WHERE u.role = 'delivery'
        GROUP BY u.id, u.name, u.rider_debt ORDER BY deliveries DESC`;
    } else {
      staffQuery = `SELECT u.name, COUNT(o.id)::int AS orders,
        COALESCE(SUM(o.total), 0)::float AS revenue,
        COALESCE(AVG(o.total), 0)::float AS avg_order
        FROM users u
        LEFT JOIN orders o ON o.created_by = u.id AND o.created_at BETWEEN $1 AND $2
        WHERE u.role = '${role}'
        GROUP BY u.id, u.name ORDER BY revenue DESC`;
    }
    data.staff = (await pool.query(staffQuery, [from, to])).rows;
  }

  return data;
}

// ─────────────────────────────────────────────
// IMPORTANT: /available must come BEFORE /:type
// (wildcard :type would otherwise catch "available")
// ─────────────────────────────────────────────

// List available reports
router.get("/available", requireAuth, requireRole("super_admin", "branch_admin"), (req, res) => {
  const reports = [
    { id: "business", name: "Business Overview", desc: "Complete company summary with all metrics", icon: "📊", roles: ["super_admin"] },
    { id: "branch", name: "Branch Performance", desc: "Single branch detailed report", icon: "🏪", roles: ["super_admin", "branch_admin"] },
    { id: "staff", name: "Staff Performance", desc: "Cashier / Chef / Rider / Call Center reports", icon: "👥", roles: ["super_admin", "branch_admin"] },
    { id: "best-sellers", name: "Best Sellers", desc: "Top selling items and categories", icon: "🔥", roles: ["super_admin", "branch_admin"] },
    { id: "financial", name: "Financial Summary", desc: "Revenue, payments, cash flow", icon: "💰", roles: ["super_admin", "branch_admin"] },
  ].filter((r) => r.roles.includes(req.user.role));
  res.json(reports);
});

// PDF generator
router.get("/:type", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  try {
    const type = req.params.type; // business | branch | staff | financial | best-sellers
    const data = await fetchReportData(type, req.user, req.query);

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const filename = `tandoor-${type}-report-${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ── Colors
    const orange = "#E8542F";
    const dark = "#1A1613";
    const gold = "#F0A93B";
    const muted = "#A89F94";
    const light = "#F5F1EB";

    // ── COVER
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
    doc.fillColor(orange).fontSize(50).text("🔥", 40, 100);
    doc.fillColor("#fff").fontSize(38).font("Helvetica-Bold").text("Tandoor", 40, 160);
    doc.fillColor(muted).fontSize(14).font("Helvetica").text("Business Report", 40, 210);

    const titles = {
      business: "Business Overview Report",
      branch: "Branch Performance Report",
      staff: `Staff Performance — ${data.staff_role || "All"}`,
      financial: "Financial Summary",
      "best-sellers": "Best Sellers Report",
    };

    doc.fillColor(orange).fontSize(28).font("Helvetica-Bold").text(titles[type] || "Report", 40, 300);
    doc.fillColor("#fff").fontSize(14).font("Helvetica").text(data.branch_name, 40, 340);
    doc.fillColor(muted).fontSize(12).text(
      `Period: ${data.from.toLocaleDateString()} — ${data.to.toLocaleDateString()}`,
      40, 365
    );
    doc.fillColor(muted).fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 40, doc.page.height - 60);

    // ── Content pages
    doc.addPage();
    let y = 40;

    function heading(text) {
      doc.fillColor(dark).fontSize(20).font("Helvetica-Bold").text(text, 40, y);
      y += 30;
      doc.rect(40, y - 5, 40, 3).fill(orange);
      y += 15;
    }

    function statBox(label, value, x) {
      doc.rect(x, y, 130, 60).fillAndStroke(light, "#EDE8E1");
      doc.fillColor(muted).fontSize(10).font("Helvetica").text(label, x + 10, y + 10);
      doc.fillColor(dark).fontSize(20).font("Helvetica-Bold").text(value, x + 10, y + 28);
    }

    if (type !== "staff") {
      heading("Overview");
      statBox("Revenue", `Rs ${Math.round(data.overview.revenue).toLocaleString()}`, 40);
      statBox("Orders", String(data.overview.orders), 180);
      statBox("Avg Order", `Rs ${Math.round(data.overview.avg_order).toLocaleString()}`, 320);
      statBox("Cancelled", String(data.overview.cancelled || 0), 460);
      y += 90;
    }

    // ── Sources
    if (data.sources && data.sources.length > 0) {
      heading("Order Sources");
      const cols = ["Source", "Orders", "Revenue", "Avg Order"];
      const widths = [180, 100, 130, 100];
      let x = 40;
      doc.fillColor(dark).fontSize(11).font("Helvetica-Bold");
      cols.forEach((c, i) => { doc.text(c, x, y); x += widths[i]; });
      y += 18;
      doc.moveTo(40, y).lineTo(550, y).strokeColor("#EDE8E1").stroke();
      y += 5;
      doc.font("Helvetica").fontSize(10);
      data.sources.forEach((s) => {
        let cx = 40;
        const labels = {
          pos: "💵 POS/Cashier",
          call_center: "📞 Call Center",
          online: "🛵 Website",
        };
        doc.fillColor(dark).text(labels[s.source] || s.source, cx, y); cx += widths[0];
        doc.text(String(s.orders), cx, y); cx += widths[1];
        doc.text(`Rs ${Math.round(s.revenue).toLocaleString()}`, cx, y); cx += widths[2];
        doc.text(`Rs ${Math.round(s.avg_order).toLocaleString()}`, cx, y);
        y += 20;
      });
      y += 10;
    }

    // ── Best sellers
    if (data.best_sellers && data.best_sellers.length > 0) {
      if (y > 650) { doc.addPage(); y = 40; }
      heading("Best Sellers (Top 10)");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(dark);
      doc.text("Rank", 40, y);
      doc.text("Item", 90, y);
      doc.text("Orders", 350, y);
      doc.text("Revenue", 440, y);
      y += 18;
      doc.moveTo(40, y).lineTo(550, y).strokeColor("#EDE8E1").stroke();
      y += 5;
      doc.font("Helvetica").fontSize(10);
      data.best_sellers.forEach((s, i) => {
        if (y > 780) { doc.addPage(); y = 40; }
        doc.fillColor(muted).text(`#${i + 1}`, 40, y);
        doc.fillColor(dark).text(s.name, 90, y);
        doc.text(String(s.orders), 350, y);
        doc.text(`Rs ${Math.round(s.revenue).toLocaleString()}`, 440, y);
        y += 20;
      });
      y += 10;
    }

    // ── Categories
    if (data.categories && data.categories.length > 0) {
      if (y > 650) { doc.addPage(); y = 40; }
      heading("Category Performance");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(dark);
      doc.text("Category", 40, y);
      doc.text("Orders", 260, y);
      doc.text("Revenue", 380, y);
      y += 18;
      doc.moveTo(40, y).lineTo(550, y).strokeColor("#EDE8E1").stroke();
      y += 5;
      doc.font("Helvetica").fontSize(10);
      const total = data.categories.reduce((s, c) => s + c.revenue, 0);
      data.categories.forEach((c) => {
        if (y > 780) { doc.addPage(); y = 40; }
        const pct = total > 0 ? Math.round((c.revenue / total) * 100) : 0;
        doc.fillColor(dark).text(`${c.category} (${pct}%)`, 40, y);
        doc.text(String(c.orders), 260, y);
        doc.text(`Rs ${Math.round(c.revenue).toLocaleString()}`, 380, y);
        y += 20;
      });
      y += 10;
    }

    // ── Branches (business only)
    if (data.branches && data.branches.length > 0) {
      if (y > 650) { doc.addPage(); y = 40; }
      heading("Branches Comparison");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(dark);
      doc.text("Branch", 40, y);
      doc.text("Orders", 220, y);
      doc.text("Revenue", 320, y);
      doc.text("Avg Order", 440, y);
      y += 18;
      doc.moveTo(40, y).lineTo(550, y).strokeColor("#EDE8E1").stroke();
      y += 5;
      doc.font("Helvetica").fontSize(10);
      data.branches.forEach((b) => {
        if (y > 780) { doc.addPage(); y = 40; }
        doc.fillColor(dark).text(b.name, 40, y);
        doc.text(String(b.orders), 220, y);
        doc.text(`Rs ${Math.round(b.revenue).toLocaleString()}`, 320, y);
        doc.text(`Rs ${Math.round(b.avg_order).toLocaleString()}`, 440, y);
        y += 20;
      });
    }

    // ── Payments
    if (data.payments && data.payments.length > 0) {
      if (y > 650) { doc.addPage(); y = 40; }
      heading("Payment Methods");
      doc.font("Helvetica-Bold").fontSize(11).fillColor(dark);
      doc.text("Method", 40, y);
      doc.text("Orders", 220, y);
      doc.text("Revenue", 340, y);
      y += 18;
      doc.moveTo(40, y).lineTo(550, y).strokeColor("#EDE8E1").stroke();
      y += 5;
      doc.font("Helvetica").fontSize(10);
      data.payments.forEach((p) => {
        doc.fillColor(dark).text(p.method === "cash" ? "💵 Cash" : "💳 Card", 40, y);
        doc.text(String(p.orders), 220, y);
        doc.text(`Rs ${Math.round(p.revenue).toLocaleString()}`, 340, y);
        y += 20;
      });
    }

    // ── Staff report
    if (data.staff && data.staff.length > 0) {
      heading(`${data.staff_role.charAt(0).toUpperCase() + data.staff_role.slice(1)} Performance`);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(dark);
      doc.text("Rank", 40, y);
      doc.text("Name", 90, y);
      if (data.staff_role === "delivery") {
        doc.text("Deliveries", 280, y);
        doc.text("Avg Time", 380, y);
        doc.text("Debt", 470, y);
      } else {
        doc.text("Orders", 280, y);
        doc.text("Revenue", 360, y);
        doc.text("Avg Order", 470, y);
      }
      y += 18;
      doc.moveTo(40, y).lineTo(550, y).strokeColor("#EDE8E1").stroke();
      y += 5;
      doc.font("Helvetica").fontSize(10);
      data.staff.forEach((s, i) => {
        if (y > 780) { doc.addPage(); y = 40; }
        doc.fillColor(muted).text(`#${i + 1}`, 40, y);
        doc.fillColor(dark).text(s.name, 90, y);
        if (data.staff_role === "delivery") {
          doc.text(String(s.deliveries || 0), 280, y);
          doc.text(`${Math.round(s.avg_delivery_min || 0)} min`, 380, y);
          doc.text(`Rs ${Math.round(s.rider_debt || 0).toLocaleString()}`, 470, y);
        } else {
          doc.text(String(s.orders || 0), 280, y);
          doc.text(`Rs ${Math.round(s.revenue || 0).toLocaleString()}`, 360, y);
          doc.text(`Rs ${Math.round(s.avg_order || 0).toLocaleString()}`, 470, y);
        }
        y += 20;
      });
    }

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = 1; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor(muted).fontSize(9).font("Helvetica")
        .text(`Tandoor Business Report · ${data.branch_name} · Page ${i}`,
          40, doc.page.height - 30, { width: 500, align: "center" });
    }

    doc.end();
  } catch (err) {
    console.error("PDF gen error:", err);
    res.status(500).json({ error: "PDF generation failed" });
  }
});

export default router;