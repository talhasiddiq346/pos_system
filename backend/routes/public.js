import { Router } from "express";
import { pool } from "../db.js";
import { validateVoucher } from "./settings.js";

const router = Router();

// The public website uses "pickup"/"cod"/"online"; the orders table (shared with
// POS/call-center) uses "takeaway"/"cash"/"card" — translate at the boundary.
function toDbOrderType(orderType) {
  return orderType === "pickup" ? "takeaway" : "delivery";
}
function toPublicOrderType(orderType) {
  return orderType === "takeaway" ? "pickup" : "delivery";
}
function toDbPaymentMethod(paymentMethod) {
  return paymentMethod === "online" ? "card" : "cash";
}
function toPublicPaymentMethod(paymentMethod) {
  return paymentMethod === "card" ? "online" : "cod";
}

// Branches list — no auth
router.get("/branches", async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, address, phone, city FROM branches ORDER BY name"
  );
  res.json(result.rows);
});

// Branch menu — no auth
router.get("/menu/:branchId", async (req, res) => {
  const { branchId } = req.params;

  const productsRes = await pool.query(
    `SELECT * FROM products
     WHERE branch_id = $1 AND is_available = true
     ORDER BY category, name`,
    [branchId]
  );

  if (productsRes.rows.length === 0) return res.json([]);

  const ids = productsRes.rows.map((p) => p.id);
  const variantsRes = await pool.query(
    `SELECT * FROM product_variants
     WHERE product_id = ANY($1::int[]) AND is_available = true
     ORDER BY id`,
    [ids]
  );

  const variantsByProduct = {};
  for (const v of variantsRes.rows) {
    if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
    variantsByProduct[v.product_id].push(v);
  }

  res.json(productsRes.rows.map((p) => ({
    ...p,
    variants: variantsByProduct[p.id] || [],
  })));
});

// Category pictures for a branch — no auth
router.get("/categories/:branchId", async (req, res) => {
  const { branchId } = req.params;
  const result = await pool.query(
    "SELECT name, image_url FROM category_images WHERE branch_id = $1 AND image_url IS NOT NULL",
    [branchId]
  );
  res.json(result.rows);
});

// Place order — no auth (online orders)
router.post("/order", async (req, res) => {
  const {
    branch_id, items, customer_name, customer_phone,
    customer_address, payment_method, order_type, voucher_code,
  } = req.body;

  if (!branch_id) return res.status(400).json({ error: "Branch is required" });
  if (!customer_name?.trim()) return res.status(400).json({ error: "Name is required" });
  if (!customer_phone?.trim()) return res.status(400).json({ error: "Phone is required" });

  const cleanedPhone = customer_phone.replace(/[\s\-\(\)]/g, "");
  const validPhone = /^03[0-9]{9}$/.test(cleanedPhone) ||
                     /^\+923[0-9]{9}$/.test(cleanedPhone) ||
                     /^923[0-9]{9}$/.test(cleanedPhone);
  if (!validPhone) return res.status(400).json({ error: "Valid Pakistani phone required" });

  const dbOrderType = toDbOrderType(order_type);
  if (dbOrderType === "delivery" && !customer_address?.trim()) {
    return res.status(400).json({ error: "Address is required" });
  }
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Cart is empty" });

  function generateOrderCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "ORD-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let subtotal = 0;
    const resolvedItems = [];

    for (const item of items) {
      const { product_id, variant_id, quantity } = item;
      if (!product_id || !quantity || quantity < 1)
        throw { status: 400, message: "Invalid item" };

      const productRes = await client.query(
        "SELECT * FROM products WHERE id = $1 AND branch_id = $2 AND is_available = true",
        [product_id, branch_id]
      );
      if (productRes.rows.length === 0)
        throw { status: 404, message: "Product not found" };
      const product = productRes.rows[0];

      let unitPrice = Number(product.price);
      let variantName = null;
      let resolvedVariantId = null;

      if (variant_id) {
        const variantRes = await client.query(
          "SELECT * FROM product_variants WHERE id = $1 AND product_id = $2 AND is_available = true",
          [variant_id, product_id]
        );
        if (variantRes.rows.length === 0)
          throw { status: 404, message: "Variant not found" };
        const variant = variantRes.rows[0];
        unitPrice = Number(product.price) + Number(variant.price);
        variantName = variant.name;
        resolvedVariantId = variant.id;
      }

      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      resolvedItems.push({
        product_id, product_name: product.name,
        variant_id: resolvedVariantId, variant_name: variantName,
        unit_price: unitPrice, quantity, line_total: lineTotal,
      });
    }

    // ── Voucher: re-validate and compute the discount server-side.
    // The client-sent discount is never trusted — only what we compute here is charged.
    let discountAmount = 0;
    let appliedVoucherCode = null;
    if (voucher_code) {
      const { error, status, voucher, discount } = await validateVoucher(client, voucher_code, subtotal);
      if (error) throw { status, message: error };
      discountAmount = discount;
      appliedVoucherCode = voucher.code;
    }
    const total = subtotal - discountAmount;

    const orderCode = generateOrderCode();
    const orderRes = await client.query(
      `INSERT INTO orders
         (branch_id, source, order_type, status, subtotal, total,
          payment_method, customer_name, customer_phone, customer_address, order_code,
          voucher_code, discount_amount)
       VALUES ($1, 'online', $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        branch_id, dbOrderType, subtotal, total,
        toDbPaymentMethod(payment_method),
        customer_name, customer_phone, customer_address || null, orderCode,
        appliedVoucherCode, discountAmount,
      ]
    );
    const order = orderRes.rows[0];

    if (appliedVoucherCode) {
      await client.query("UPDATE vouchers SET used_count = used_count + 1 WHERE code = $1", [appliedVoucherCode]);
    }

    for (const it of resolvedItems) {
      await client.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name, variant_id, variant_name,
            unit_price, quantity, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [order.id, it.product_id, it.product_name, it.variant_id,
         it.variant_name, it.unit_price, it.quantity, it.line_total]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      order_code: order.order_code,
      total: order.total,
      discount_amount: order.discount_amount,
      status: order.status,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  } finally {
    client.release();
  }
});

// Track order — no auth
router.get("/track/:orderCode", async (req, res) => {
  const { orderCode } = req.params;

  const result = await pool.query(
    `SELECT o.id, o.order_code, o.status, o.order_type, o.payment_method,
            o.customer_name, o.customer_phone, o.customer_address,
            o.total, o.discount_amount, o.created_at,
            b.name AS branch_name, b.address AS branch_address, b.phone AS branch_phone,
            CASE WHEN o.status IN ('dispatched','delivered')
              THEN u.name ELSE NULL END AS rider_name,
            CASE WHEN o.status IN ('dispatched','delivered')
              THEN u.phone ELSE NULL END AS rider_phone
     FROM orders o
     JOIN branches b ON b.id = o.branch_id
     LEFT JOIN delivery_assignments da ON da.order_id = o.id
       AND da.status = 'accepted'
     LEFT JOIN users u ON u.id = da.rider_id
     WHERE o.order_code = $1`,
    [orderCode.toUpperCase()]
  );

  if (result.rows.length === 0)
    return res.status(404).json({ error: "Order not found. Check your order code." });

  const order = result.rows[0];

  const itemsRes = await pool.query(
    `SELECT product_name AS name, variant_name AS variant, quantity AS qty, unit_price AS price
     FROM order_items WHERE order_id = $1 ORDER BY id`,
    [order.id]
  );

  res.json({
    ...order,
    order_type: toPublicOrderType(order.order_type),
    payment_method: toPublicPaymentMethod(order.payment_method),
    items: itemsRes.rows,
  });
});

export default router;