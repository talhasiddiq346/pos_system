import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { io } from "../server.js";
import { startRiderTimer } from "../lib/riderTimers.js";
import { validate, createOrderSchema } from "../lib/validate.js";
import { validateVoucher } from "./settings.js";

const router = Router();

const ALL_ROLES = ["cashier", "branch_admin", "super_admin", "call_center", "chef", "delivery"];
function generateOrderCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "ORD-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
export async function tryAssignRider(orderId, branchId, attempt = 1) {
  const existing = await pool.query(
    "SELECT id FROM delivery_assignments WHERE order_id = $1 AND status IN ('pending','accepted')",
    [orderId]
  );
  if (existing.rows.length > 0) return;

  const riderResult = await pool.query(
    `SELECT u.id, u.rider_status,
       COUNT(da.id) FILTER (WHERE da.status = 'accepted') AS active_orders
     FROM users u
     LEFT JOIN delivery_assignments da ON da.rider_id = u.id
     WHERE u.branch_id = $1
       AND u.role = 'delivery'
       AND u.rider_status IN ('available', 'busy')
     GROUP BY u.id, u.rider_status
     HAVING COUNT(da.id) FILTER (WHERE da.status = 'accepted') < 5
     ORDER BY
       CASE u.rider_status WHEN 'available' THEN 0 ELSE 1 END ASC,
       active_orders ASC
     LIMIT 1`,
    [branchId]
  );

  if (riderResult.rows.length === 0) {
    io.to(`branch_${branchId}_branch_admin`).emit("no_rider_available", {
      order_id: orderId,
      message: "No riders available — order in waiting queue",
    });
    return;
  }

  const rider = riderResult.rows[0];

  await pool.query(
    `INSERT INTO delivery_assignments (order_id, rider_id, attempt, status, accepted_at, trip_started_at)
     VALUES ($1, $2, $3, 'accepted', NOW(), NOW())`,
    [orderId, rider.id, attempt]
  );

  await pool.query(
    "UPDATE orders SET status = 'dispatched' WHERE id = $1",
    [orderId]
  );

  await pool.query(
    "UPDATE users SET rider_status = 'busy' WHERE id = $1 AND rider_status = 'available'",
    [rider.id]
  );

  startRiderTimer(rider.id, branchId);

  io.to(`rider_${rider.id}`).emit("new_assignment", { order_id: orderId });
}

// Chef manually assigns order to specific rider
router.patch(
  "/:id/assign",
  requireAuth,
  requireRole("chef", "branch_admin", "super_admin"),
  async (req, res) => {
    const { id } = req.params;
    const { rider_id } = req.body;

    if (!rider_id) return res.status(400).json({ error: "rider_id is required" });

    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (orderResult.rows.length === 0)
      return res.status(404).json({ error: "Order not found" });
    const order = orderResult.rows[0];

    if (order.status !== "ready")
      return res.status(409).json({ error: "Only ready orders can be assigned" });

    // Check existing assignment for THIS specific order
    const existing = await pool.query(
      "SELECT id FROM delivery_assignments WHERE order_id = $1 AND status IN ('pending','accepted')",
      [id]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "This order is already assigned to a rider" });

    // Rider validation
    const riderResult = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND role = 'delivery' AND branch_id = $2",
      [rider_id, order.branch_id]
    );
    if (riderResult.rows.length === 0)
      return res.status(404).json({ error: "Rider not found in this branch" });
    const rider = riderResult.rows[0];

    // Check max 5 limit
    const activeCount = await pool.query(
      "SELECT COUNT(*) FROM delivery_assignments WHERE rider_id = $1 AND status = 'accepted'",
      [rider_id]
    );
    if (parseInt(activeCount.rows[0].count) >= 5)
      return res.status(409).json({ error: "Rider already has 5 orders — maximum limit reached" });

    // Create assignment
    await pool.query(
      `INSERT INTO delivery_assignments (order_id, rider_id, attempt, status, accepted_at, trip_started_at)
       VALUES ($1, $2, 1, 'accepted', NOW(), NOW())`,
      [id, rider_id]
    );

    // Order dispatched — cannot be assigned again
    await pool.query(
      "UPDATE orders SET status = 'dispatched' WHERE id = $1",
      [id]
    );

    // Rider busy mark
    await pool.query(
      "UPDATE users SET rider_status = 'busy' WHERE id = $1 AND rider_status = 'available'",
      [rider_id]
    );

    // Notify rider
    const newCount = parseInt(activeCount.rows[0].count) + 1;
    if (newCount >= 5) {
      io.to(`rider_${rider_id}`).emit("max_orders_reached", {
        message: "5 orders assigned! Please go deliver now.",
        order_count: 5,
      });
    } else {
      startRiderTimer(rider_id, order.branch_id);
    }

    io.to(`rider_${rider_id}`).emit("new_assignment", {
      order_id: parseInt(id),
      assigned_by: "chef",
    });

    res.json({ ok: true, rider_name: rider.name, order_id: parseInt(id) });
  }
);

router.get("/", requireAuth, requireRole(...ALL_ROLES), async (req, res) => {
  const branchId =
    req.user.role === "super_admin"
      ? req.query.branch_id || null
      : req.user.branch_id;

  const query = `
    SELECT o.*, u.name AS created_by_name, rt.name AS restaurant_table_name
    FROM orders o
    LEFT JOIN users u ON u.id = o.created_by
    LEFT JOIN restaurant_tables rt ON rt.id = o.restaurant_table_id
    ${branchId ? "WHERE o.branch_id = $1" : ""}
    ORDER BY o.created_at DESC LIMIT 100
  `;

  const result = branchId
    ? await pool.query(query, [branchId])
    : await pool.query(query);

  res.json(result.rows);
});

router.get("/:id", requireAuth, requireRole(...ALL_ROLES), async (req, res) => {
  const { id } = req.params;

  const orderResult = await pool.query(
    `SELECT o.*, u.name AS created_by_name, rt.name AS restaurant_table_name
     FROM orders o
     LEFT JOIN users u ON u.id = o.created_by
     LEFT JOIN restaurant_tables rt ON rt.id = o.restaurant_table_id
     WHERE o.id = $1`,
    [id]
  );
  if (orderResult.rows.length === 0)
    return res.status(404).json({ error: "Order not found" });
  const order = orderResult.rows[0];

  if (req.user.role !== "super_admin" && order.branch_id !== req.user.branch_id)
    return res.status(403).json({ error: "You can only view orders from your own branch" });

  const itemsResult = await pool.query(
    "SELECT * FROM order_items WHERE order_id = $1 ORDER BY id",
    [id]
  );

  const assignmentResult = await pool.query(
    `SELECT da.*, u.name AS rider_name
     FROM delivery_assignments da
     LEFT JOIN users u ON u.id = da.rider_id
     WHERE da.order_id = $1 ORDER BY da.attempt DESC LIMIT 1`,
    [id]
  );

  res.json({
    ...order,
    items: itemsResult.rows,
    assignment: assignmentResult.rows[0] || null,
  });
});

router.post(
  "/",
  requireAuth,
  requireRole("cashier", "branch_admin", "super_admin", "call_center"),
  async (req, res) => {
    const validated = validate(createOrderSchema, req.body);
    const { items, customer_name, customer_phone, customer_address,
      payment_method, branch_id, source, order_type, table_number, voucher_code } = validated;

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "Cart is empty" });

    const branchId =
      ["super_admin", "call_center"].includes(req.user.role)
        ? branch_id
        : req.user.branch_id;

    if (!branchId) return res.status(400).json({ error: "Branch is required" });

    const finalOrderType = order_type || "takeaway";
    if (finalOrderType === "delivery" && !customer_address)
      return res.status(400).json({ error: "Delivery address is required" });

    const orderSource =
      req.user.role === "call_center" ? "call_center" :
        ["super_admin", "branch_admin"].includes(req.user.role) ? (source || "pos") : "pos";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let subtotal = 0;
      const resolvedItems = [];

      for (const item of items) {
        const { product_id, variant_id, quantity, addon_option_ids } = item;
        if (!product_id || !quantity || quantity < 1)
          throw { status: 400, message: "Invalid item in cart" };

        const productResult = await client.query(
          "SELECT * FROM products WHERE id = $1 AND branch_id = $2",
          [product_id, branchId]
        );
        if (productResult.rows.length === 0)
          throw { status: 404, message: "Product not found" };
        const product = productResult.rows[0];
        if (!product.is_available)
          throw { status: 409, message: `${product.name} is currently unavailable` };

        let unitPrice = Number(product.discounted_price ?? product.price);
        let variantName = null;
        let resolvedVariantId = null;

        if (variant_id) {
          const variantResult = await client.query(
            "SELECT * FROM product_variants WHERE id = $1 AND product_id = $2",
            [variant_id, product_id]
          );
          if (variantResult.rows.length === 0)
            throw { status: 404, message: "Variant not found" };
          const variant = variantResult.rows[0];
          if (!variant.is_available)
            throw { status: 409, message: `${variant.name} is currently unavailable` };
          unitPrice = Number(product.price) + Number(variant.price);
          variantName = variant.name;
          resolvedVariantId = variant.id;
        }

        // Add-ons: re-validate against THIS product's own groups and re-price from the DB.
        let selectedAddons = [];
        if (Array.isArray(addon_option_ids) && addon_option_ids.length > 0) {
          const optionsResult = await client.query(
            `SELECT ao.* FROM addon_options ao
             JOIN addon_groups ag ON ag.id = ao.group_id
             WHERE ao.id = ANY($1::int[]) AND ag.product_id = $2 AND ao.is_available = true`,
            [addon_option_ids, product_id]
          );
          if (optionsResult.rows.length !== addon_option_ids.length)
            throw { status: 400, message: "One or more selected add-ons are invalid" };

          selectedAddons = optionsResult.rows.map((o) => ({ name: o.name, price: Number(o.price) }));
          unitPrice += selectedAddons.reduce((s, a) => s + a.price, 0);
        }

        const lineTotal = unitPrice * quantity;
        subtotal += lineTotal;
        resolvedItems.push({
          product_id, product_name: product.name,
          variant_id: resolvedVariantId, variant_name: variantName,
          unit_price: unitPrice, quantity, line_total: lineTotal,
          selected_addons: selectedAddons,
        });
      }

      // Voucher/discount — re-validated and re-priced server-side, same as the public website flow.
      let discountAmount = 0;
      let appliedVoucherCode = null;
      if (voucher_code) {
        const { error, status, voucher, discount } = await validateVoucher(client, voucher_code, subtotal);
        if (error) throw { status, message: error };
        discountAmount = discount;
        appliedVoucherCode = voucher.code;
      }

      const settingsResult = await client.query("SELECT tax_rate FROM site_settings WHERE id = 1");
      const taxRate = Number(settingsResult.rows[0]?.tax_rate || 0);
      const taxAmount = Math.round((subtotal - discountAmount) * (taxRate / 100) * 100) / 100;
      const total = subtotal - discountAmount + taxAmount;

      const orderCode = generateOrderCode();
      const orderResult = await client.query(
        `INSERT INTO orders
     (branch_id, source, order_type, status, subtotal, total,
      payment_method, customer_name, customer_phone, customer_address, created_by, order_code,
      table_number, discount_amount, voucher_code, tax_amount)
   VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
        [
          branchId, orderSource, finalOrderType, subtotal, total,
          payment_method || "cash", customer_name || null,
          customer_phone || null, customer_address || null, req.user.id, orderCode,
          table_number || null, discountAmount, appliedVoucherCode, taxAmount,
        ]
      );
      const order = orderResult.rows[0];

      if (appliedVoucherCode) {
        await client.query("UPDATE vouchers SET used_count = used_count + 1 WHERE code = $1", [appliedVoucherCode]);
      }

      const insertedItems = [];
      for (const it of resolvedItems) {
        const itemResult = await client.query(
          `INSERT INTO order_items
             (order_id, product_id, product_name, variant_id, variant_name,
              unit_price, quantity, line_total, selected_addons)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [order.id, it.product_id, it.product_name, it.variant_id,
          it.variant_name, it.unit_price, it.quantity, it.line_total,
          JSON.stringify(it.selected_addons)]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      await client.query("COMMIT");

      io.to(`branch_${branchId}_cashier`).emit("new_order", {
        id: order.id, source: orderSource, total: subtotal,
      });
      io.to(`branch_${branchId}_chef`).emit("new_order", {
        id: order.id, source: orderSource, total: subtotal,
      });

      res.status(201).json({ ...order, items: insertedItems });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(err.status || 500).json({ error: err.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("chef", "cashier", "branch_admin", "super_admin"),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "preparing", "ready", "dispatched", "delivered", "completed", "cancelled"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ error: "Invalid status" });

    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (orderResult.rows.length === 0)
      return res.status(404).json({ error: "Order not found" });
    const order = orderResult.rows[0];

    if (req.user.role !== "super_admin" && order.branch_id !== req.user.branch_id)
      return res.status(403).json({ error: "You can only update orders from your own branch" });

    if (req.user.role === "chef" && !["preparing", "ready"].includes(status))
      return res.status(403).json({ error: "Chef can only mark orders as preparing or ready" });

    if (req.user.role === "cashier" && !["cancelled"].includes(status))
      return res.status(403).json({ error: "Cashier can only cancel orders" });

    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    const updated = result.rows[0];

    if (status === "ready") {
      if (updated.order_type === "takeaway") {
        await pool.query("UPDATE orders SET status = 'completed' WHERE id = $1", [id]);
        updated.status = "completed";
      }
    } else {
      // Check available riders
      const availableRiders = await pool.query(
        `SELECT COUNT(*) FROM users
     WHERE branch_id = $1 AND role = 'delivery'
       AND rider_status IN ('available', 'busy')`,
        [updated.branch_id]
      );
      const hasRiders = parseInt(availableRiders.rows[0].count) > 0;

      io.to(`branch_${updated.branch_id}_chef`).emit("order_needs_assignment", {
        id: updated.id,
        customer_name: updated.customer_name,
        has_riders: hasRiders,
      });
    }

    res.json(updated);
  }
);

export default router;