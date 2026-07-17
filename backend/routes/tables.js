import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateVoucher } from "./settings.js";

const router = Router();

function generateOrderCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "ORD-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function branchIdFor(req) {
  return req.user.role === "super_admin" ? Number(req.query.branch_id || req.body.branch_id) : req.user.branch_id;
}

async function getTableWithBranch(id) {
  const result = await pool.query("SELECT * FROM restaurant_tables WHERE id = $1", [id]);
  return result.rows[0];
}

// ═══════════════════════════════════════════════════
// TABLE MANAGEMENT (admin)
// ═══════════════════════════════════════════════════

router.get("/", requireAuth, requireRole("super_admin", "branch_admin", "cashier"), async (req, res) => {
  const branchId = branchIdFor(req);
  if (!branchId) return res.status(400).json({ error: "Branch is required" });

  const tablesRes = await pool.query(
    `SELECT t.*, o.id AS open_order_id, o.subtotal AS open_subtotal, o.created_at AS open_since
     FROM restaurant_tables t
     LEFT JOIN orders o ON o.restaurant_table_id = t.id AND o.tab_status = 'open'
     WHERE t.branch_id = $1 AND t.is_active = true
     ORDER BY t.name`,
    [branchId]
  );
  res.json(tablesRes.rows);
});

router.post("/", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { name, seats } = req.body;
  const branchId = req.user.role === "branch_admin" ? req.user.branch_id : req.body.branch_id;

  if (!branchId) return res.status(400).json({ error: "Branch is required" });
  if (!name?.trim()) return res.status(400).json({ error: "Table name is required" });

  try {
    const result = await pool.query(
      `INSERT INTO restaurant_tables (branch_id, name, seats) VALUES ($1, $2, $3) RETURNING *`,
      [branchId, name.trim(), seats ? Number(seats) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "A table with this name already exists" });
    throw err;
  }
});

router.patch("/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const { name, seats, is_active } = req.body;

  const table = await getTableWithBranch(id);
  if (!table) return res.status(404).json({ error: "Table not found" });
  if (req.user.role === "branch_admin" && table.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's tables" });
  }

  const result = await pool.query(
    `UPDATE restaurant_tables SET
       name = COALESCE($1, name),
       seats = $2,
       is_active = COALESCE($3, is_active)
     WHERE id = $4 RETURNING *`,
    [name?.trim() ?? null, seats !== undefined ? (seats === null ? null : Number(seats)) : table.seats, is_active ?? null, id]
  );
  res.json(result.rows[0]);
});

router.delete("/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const table = await getTableWithBranch(id);
  if (!table) return res.status(404).json({ error: "Table not found" });
  if (req.user.role === "branch_admin" && table.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's tables" });
  }

  const openOrder = await pool.query(
    "SELECT id FROM orders WHERE restaurant_table_id = $1 AND tab_status = 'open'",
    [id]
  );
  if (openOrder.rows.length > 0) {
    return res.status(400).json({ error: "This table has an open tab — finalize its bill first" });
  }

  await pool.query("DELETE FROM restaurant_tables WHERE id = $1", [id]);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// RUNNING TAB — open order per table
// ═══════════════════════════════════════════════════

router.get("/:id/order", requireAuth, requireRole("super_admin", "branch_admin", "cashier"), async (req, res) => {
  const { id } = req.params;
  const table = await getTableWithBranch(id);
  if (!table) return res.status(404).json({ error: "Table not found" });
  if (req.user.role !== "super_admin" && table.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "Access denied" });
  }

  const orderRes = await pool.query(
    "SELECT * FROM orders WHERE restaurant_table_id = $1 AND tab_status = 'open'",
    [id]
  );
  if (orderRes.rows.length === 0) return res.json(null);

  const itemsRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1 ORDER BY id", [orderRes.rows[0].id]);
  res.json({ ...orderRes.rows[0], items: itemsRes.rows });
});

router.post(
  "/:id/items",
  requireAuth,
  requireRole("super_admin", "branch_admin", "cashier"),
  async (req, res) => {
    const { id } = req.params;
    const { items, customer_name } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }

    const table = await getTableWithBranch(id);
    if (!table) return res.status(404).json({ error: "Table not found" });
    if (req.user.role !== "super_admin" && table.branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let order = (await client.query(
        "SELECT * FROM orders WHERE restaurant_table_id = $1 AND tab_status = 'open' FOR UPDATE",
        [id]
      )).rows[0];

      if (!order) {
        const orderCode = generateOrderCode();
        const created = await client.query(
          `INSERT INTO orders
             (branch_id, source, order_type, status, subtotal, total,
              payment_method, customer_name, created_by, order_code,
              restaurant_table_id, tab_status)
           VALUES ($1, 'pos', 'dine_in', 'pending', 0, 0, 'cash', $2, $3, $4, $5, 'open')
           RETURNING *`,
          [table.branch_id, customer_name || null, req.user.id, orderCode, id]
        );
        order = created.rows[0];
      }

      const resolvedItems = [];
      for (const item of items) {
        const { product_id, variant_id, quantity, addon_option_ids } = item;
        if (!product_id || !quantity || quantity < 1) throw { status: 400, message: "Invalid item" };

        const productRes = await client.query(
          "SELECT * FROM products WHERE id = $1 AND branch_id = $2 AND is_available = true",
          [product_id, table.branch_id]
        );
        if (productRes.rows.length === 0) throw { status: 404, message: "Product not found" };
        const product = productRes.rows[0];

        let unitPrice = Number(product.discounted_price ?? product.price);
        let variantName = null;
        let resolvedVariantId = null;

        if (variant_id) {
          const variantRes = await client.query(
            "SELECT * FROM product_variants WHERE id = $1 AND product_id = $2 AND is_available = true",
            [variant_id, product_id]
          );
          if (variantRes.rows.length === 0) throw { status: 404, message: "Variant not found" };
          const variant = variantRes.rows[0];
          unitPrice += Number(variant.price);
          variantName = variant.name;
          resolvedVariantId = variant.id;
        }

        let selectedAddons = [];
        if (Array.isArray(addon_option_ids) && addon_option_ids.length > 0) {
          const optionsRes = await client.query(
            `SELECT ao.* FROM addon_options ao
             JOIN addon_groups ag ON ag.id = ao.group_id
             WHERE ao.id = ANY($1::int[]) AND ag.product_id = $2 AND ao.is_available = true`,
            [addon_option_ids, product_id]
          );
          if (optionsRes.rows.length !== addon_option_ids.length) throw { status: 400, message: "One or more selected add-ons are invalid" };
          selectedAddons = optionsRes.rows.map((o) => ({ name: o.name, price: Number(o.price) }));
          unitPrice += selectedAddons.reduce((s, a) => s + a.price, 0);
        }

        const lineTotal = unitPrice * quantity;
        resolvedItems.push({
          product_id, product_name: product.name, variant_id: resolvedVariantId, variant_name: variantName,
          unit_price: unitPrice, quantity, line_total: lineTotal, selected_addons: selectedAddons,
        });
      }

      for (const it of resolvedItems) {
        await client.query(
          `INSERT INTO order_items
             (order_id, product_id, product_name, variant_id, variant_name, unit_price, quantity, line_total, selected_addons)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [order.id, it.product_id, it.product_name, it.variant_id, it.variant_name, it.unit_price, it.quantity, it.line_total, JSON.stringify(it.selected_addons)]
        );
      }

      const totalsRes = await client.query(
        "SELECT COALESCE(SUM(line_total), 0) AS subtotal FROM order_items WHERE order_id = $1",
        [order.id]
      );
      const newSubtotal = Number(totalsRes.rows[0].subtotal);
      const updated = await client.query(
        "UPDATE orders SET subtotal = $1, total = $1 WHERE id = $2 RETURNING *",
        [newSubtotal, order.id]
      );

      await client.query("COMMIT");

      const itemsRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1 ORDER BY id", [order.id]);
      res.status(201).json({ ...updated.rows[0], items: itemsRes.rows });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(err.status || 500).json({ error: err.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/:id/items/:itemId",
  requireAuth,
  requireRole("super_admin", "branch_admin", "cashier"),
  async (req, res) => {
    const { id, itemId } = req.params;

    const table = await getTableWithBranch(id);
    if (!table) return res.status(404).json({ error: "Table not found" });
    if (req.user.role !== "super_admin" && table.branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const order = (await pool.query(
      "SELECT * FROM orders WHERE restaurant_table_id = $1 AND tab_status = 'open'",
      [id]
    )).rows[0];
    if (!order) return res.status(404).json({ error: "No open tab for this table" });

    const deleted = await pool.query(
      "DELETE FROM order_items WHERE id = $1 AND order_id = $2 RETURNING id",
      [itemId, order.id]
    );
    if (deleted.rows.length === 0) return res.status(404).json({ error: "Item not found on this tab" });

    const totalsRes = await pool.query(
      "SELECT COALESCE(SUM(line_total), 0) AS subtotal FROM order_items WHERE order_id = $1",
      [order.id]
    );
    const newSubtotal = Number(totalsRes.rows[0].subtotal);
    const updated = await pool.query(
      "UPDATE orders SET subtotal = $1, total = $1 WHERE id = $2 RETURNING *",
      [newSubtotal, order.id]
    );

    res.json(updated.rows[0]);
  }
);

router.post(
  "/:id/finalize",
  requireAuth,
  requireRole("super_admin", "branch_admin", "cashier"),
  async (req, res) => {
    const { id } = req.params;
    const { payment_method, voucher_code } = req.body;

    const table = await getTableWithBranch(id);
    if (!table) return res.status(404).json({ error: "Table not found" });
    if (req.user.role !== "super_admin" && table.branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const order = (await client.query(
        "SELECT * FROM orders WHERE restaurant_table_id = $1 AND tab_status = 'open' FOR UPDATE",
        [id]
      )).rows[0];
      if (!order) throw { status: 404, message: "No open tab for this table" };

      const itemsCount = await client.query("SELECT COUNT(*)::int AS c FROM order_items WHERE order_id = $1", [order.id]);
      if (itemsCount.rows[0].c === 0) throw { status: 400, message: "Add at least one item before generating the bill" };

      const subtotal = Number(order.subtotal);

      let discountAmount = 0;
      let appliedVoucherCode = null;
      if (voucher_code) {
        const { error, status, voucher, discount } = await validateVoucher(client, voucher_code, subtotal);
        if (error) throw { status, message: error };
        discountAmount = discount;
        appliedVoucherCode = voucher.code;
      }

      const settingsRes = await client.query("SELECT tax_rate FROM site_settings WHERE id = 1");
      const taxRate = Number(settingsRes.rows[0]?.tax_rate || 0);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
      const total = afterDiscount + taxAmount;

      const updated = await client.query(
        `UPDATE orders SET
           tab_status = 'closed', total = $1, discount_amount = $2, voucher_code = $3,
           tax_amount = $4, payment_method = $5
         WHERE id = $6 RETURNING *`,
        [total, discountAmount, appliedVoucherCode, taxAmount, payment_method || "cash", order.id]
      );

      if (appliedVoucherCode) {
        await client.query("UPDATE vouchers SET used_count = used_count + 1 WHERE code = $1", [appliedVoucherCode]);
      }

      await client.query("COMMIT");

      const itemsRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1 ORDER BY id", [order.id]);
      res.json({ ...updated.rows[0], items: itemsRes.rows });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(err.status || 500).json({ error: err.message || "Server error" });
    } finally {
      client.release();
    }
  }
);

export default router;
