import { Router } from "express";
import { pool } from "../db.js";
import { validateVoucher } from "./settings.js";
import { getAddonGroupsByProduct } from "./products.js";
import { sendOrderConfirmationEmail } from "../lib/email.js";

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

  const addonGroupsByProduct = await getAddonGroupsByProduct(ids);
  // Only surface available options to customers.
  const publicAddonGroups = {};
  for (const [pid, groups] of Object.entries(addonGroupsByProduct)) {
    publicAddonGroups[pid] = groups.map((g) => ({
      ...g,
      options: g.options.filter((o) => o.is_available),
    }));
  }

  res.json(productsRes.rows.map((p) => ({
    ...p,
    variants: variantsByProduct[p.id] || [],
    addon_groups: publicAddonGroups[p.id] || [],
  })));
});

// Category pictures + display order for a branch — no auth
router.get("/categories/:branchId", async (req, res) => {
  const { branchId } = req.params;
  const result = await pool.query(
    "SELECT name, image_url, sort_order FROM category_images WHERE branch_id = $1",
    [branchId]
  );
  res.json(result.rows);
});

// Place order — no auth (online orders)
router.post("/order", async (req, res) => {
  const {
    branch_id, items, customer_name, customer_phone,
    customer_address, customer_email, payment_method, order_type, voucher_code,
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
      const { product_id, variant_id, quantity, addon_option_ids } = item;
      if (!product_id || !quantity || quantity < 1)
        throw { status: 400, message: "Invalid item" };

      const productRes = await client.query(
        "SELECT * FROM products WHERE id = $1 AND branch_id = $2 AND is_available = true AND is_out_of_stock = false",
        [product_id, branch_id]
      );
      if (productRes.rows.length === 0)
        throw { status: 404, message: "Product not found or out of stock" };
      const product = productRes.rows[0];

      let unitPrice = Number(product.discounted_price ?? product.price);
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

      // Add-ons: re-validate each chosen option against THIS product's own groups,
      // and re-price from the DB — never trust a client-sent price.
      let selectedAddons = [];
      if (Array.isArray(addon_option_ids) && addon_option_ids.length > 0) {
        const optionsRes = await client.query(
          `SELECT ao.* FROM addon_options ao
           JOIN addon_groups ag ON ag.id = ao.group_id
           WHERE ao.id = ANY($1::int[]) AND ag.product_id = $2 AND ao.is_available = true`,
          [addon_option_ids, product_id]
        );
        if (optionsRes.rows.length !== addon_option_ids.length)
          throw { status: 400, message: "One or more selected add-ons are invalid" };

        selectedAddons = optionsRes.rows.map((o) => ({ name: o.name, price: Number(o.price) }));
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

    // ── Tax + delivery fee: admin-configured (site_settings), applied server-side.
    const settingsRes = await client.query("SELECT tax_rate, delivery_fee, brand_name FROM site_settings WHERE id = 1");
    const taxRate = Number(settingsRes.rows[0]?.tax_rate || 0);
    const deliveryFee = dbOrderType === "delivery" ? Number(settingsRes.rows[0]?.delivery_fee || 0) : 0;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
    const total = afterDiscount + taxAmount + deliveryFee;

    const orderCode = generateOrderCode();
    const orderRes = await client.query(
      `INSERT INTO orders
         (branch_id, source, order_type, status, subtotal, total,
          payment_method, customer_name, customer_phone, customer_address, customer_email, order_code,
          voucher_code, discount_amount, tax_amount, delivery_fee)
       VALUES ($1, 'online', $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        branch_id, dbOrderType, subtotal, total,
        toDbPaymentMethod(payment_method),
        customer_name, customer_phone, customer_address || null, customer_email || null, orderCode,
        appliedVoucherCode, discountAmount, taxAmount, deliveryFee,
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
            unit_price, quantity, line_total, selected_addons)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [order.id, it.product_id, it.product_name, it.variant_id,
         it.variant_name, it.unit_price, it.quantity, it.line_total,
         JSON.stringify(it.selected_addons)]
      );
    }

    await client.query("COMMIT");

    if (customer_email) {
      sendOrderConfirmationEmail({
        to: customer_email,
        brandName: settingsRes.rows[0]?.brand_name || "Tandoor",
        orderCode: order.order_code,
        total: order.total,
        items: resolvedItems,
      }).catch(() => {}); // never let an email failure affect the order response
    }

    res.status(201).json({
      order_code: order.order_code,
      total: order.total,
      discount_amount: order.discount_amount,
      tax_amount: order.tax_amount,
      delivery_fee: order.delivery_fee,
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
            o.total, o.subtotal, o.discount_amount, o.tax_amount, o.delivery_fee, o.created_at,
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
    `SELECT product_name AS name, variant_name AS variant, quantity AS qty, unit_price AS price, selected_addons
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