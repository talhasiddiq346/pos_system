import { Router } from "express";
import multer from "multer";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from "../lib/cloudinary.js";

const router = Router();

const cloudUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max — banner/logo photos run larger than product thumbnails
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG/PNG/WebP images allowed"));
  },
});

// ═══════════════════════════════════════════════════
// SITE SETTINGS (branding) — singleton row
// ═══════════════════════════════════════════════════

router.get("/", async (req, res) => {
  const result = await pool.query("SELECT * FROM site_settings WHERE id = 1");
  res.json(result.rows[0]);
});

router.put("/", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { brand_name, primary_color, secondary_color, background_color, tax_rate, delivery_fee } = req.body;

  if (tax_rate !== undefined && tax_rate !== null && Number(tax_rate) < 0) {
    return res.status(400).json({ error: "Tax rate cannot be negative" });
  }
  if (delivery_fee !== undefined && delivery_fee !== null && Number(delivery_fee) < 0) {
    return res.status(400).json({ error: "Delivery fee cannot be negative" });
  }

  const result = await pool.query(
    `UPDATE site_settings SET
       brand_name = COALESCE($1, brand_name),
       primary_color = COALESCE($2, primary_color),
       secondary_color = COALESCE($3, secondary_color),
       background_color = COALESCE($4, background_color),
       tax_rate = COALESCE($5, tax_rate),
       delivery_fee = COALESCE($6, delivery_fee),
       updated_at = now()
     WHERE id = 1 RETURNING *`,
    [
      brand_name?.trim() || null, primary_color || null, secondary_color || null, background_color || null,
      tax_rate !== undefined && tax_rate !== null ? Number(tax_rate) : null,
      delivery_fee !== undefined && delivery_fee !== null ? Number(delivery_fee) : null,
    ]
  );
  res.json(result.rows[0]);
});

router.post(
  "/logo",
  requireAuth,
  requireRole("super_admin"),
  cloudUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No image file received" });

      const existing = await pool.query("SELECT logo_url FROM site_settings WHERE id = 1");
      const oldPublicId = extractPublicId(existing.rows[0]?.logo_url);

      const { url } = await uploadToCloudinary(req.file.buffer, "tandoor/branding");
      const result = await pool.query(
        `UPDATE site_settings SET logo_url = $1, updated_at = now() WHERE id = 1 RETURNING *`,
        [url]
      );

      if (oldPublicId) await deleteFromCloudinary(oldPublicId);

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Logo upload error:", err);
      if (err.message?.includes("images allowed")) return res.status(400).json({ error: err.message });
      res.status(500).json({ error: "Logo upload failed" });
    }
  }
);

router.delete("/logo", requireAuth, requireRole("super_admin"), async (req, res) => {
  const existing = await pool.query("SELECT logo_url FROM site_settings WHERE id = 1");
  const publicId = extractPublicId(existing.rows[0]?.logo_url);

  const result = await pool.query(
    `UPDATE site_settings SET logo_url = NULL, updated_at = now() WHERE id = 1 RETURNING *`
  );
  if (publicId) await deleteFromCloudinary(publicId);

  res.json(result.rows[0]);
});

router.post(
  "/banner",
  requireAuth,
  requireRole("super_admin"),
  cloudUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No image file received" });
      const { link } = req.body;

      const { url, publicId } = await uploadToCloudinary(req.file.buffer, "tandoor/banners");

      const current = await pool.query("SELECT banner_images FROM site_settings WHERE id = 1");
      const banners = current.rows[0]?.banner_images || [];
      banners.push({ image_url: url, public_id: publicId, link: link || null });

      const result = await pool.query(
        `UPDATE site_settings SET banner_images = $1, updated_at = now() WHERE id = 1 RETURNING *`,
        [JSON.stringify(banners)]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Banner upload error:", err);
      if (err.message?.includes("images allowed")) return res.status(400).json({ error: err.message });
      res.status(500).json({ error: "Banner upload failed" });
    }
  }
);

// Replace the whole banner list — used by the admin UI for reordering/removing slides.
router.put("/banners", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { banners } = req.body;
  if (!Array.isArray(banners)) return res.status(400).json({ error: "banners must be an array" });

  const current = await pool.query("SELECT banner_images FROM site_settings WHERE id = 1");
  const before = current.rows[0]?.banner_images || [];
  const keptIds = new Set(banners.map((b) => b.public_id).filter(Boolean));

  for (const old of before) {
    if (old.public_id && !keptIds.has(old.public_id)) await deleteFromCloudinary(old.public_id);
  }

  const result = await pool.query(
    `UPDATE site_settings SET banner_images = $1, updated_at = now() WHERE id = 1 RETURNING *`,
    [JSON.stringify(banners)]
  );
  res.json(result.rows[0]);
});

// ═══════════════════════════════════════════════════
// VOUCHERS
// ═══════════════════════════════════════════════════

// Public — surfaces a headline promo (best active voucher) on the ordering site.
router.get("/vouchers/active", async (req, res) => {
  const result = await pool.query(
    `SELECT code, label, discount_type, discount_value, max_discount_cap, min_order_amount
     FROM vouchers
     WHERE is_active = true
       AND (expires_at IS NULL OR expires_at > now())
       AND (max_uses IS NULL OR used_count < max_uses)
     ORDER BY discount_value DESC
     LIMIT 1`
  );
  res.json(result.rows[0] || null);
});

router.get("/vouchers", requireAuth, requireRole("super_admin"), async (req, res) => {
  const result = await pool.query("SELECT * FROM vouchers ORDER BY created_at DESC");
  res.json(result.rows);
});

router.post("/vouchers", requireAuth, requireRole("super_admin"), async (req, res) => {
  const {
    code, label, discount_type, discount_value,
    max_discount_cap, min_order_amount, max_uses, expires_at,
  } = req.body;

  if (!code?.trim()) return res.status(400).json({ error: "Code is required" });
  if (!["percent", "fixed"].includes(discount_type)) {
    return res.status(400).json({ error: "discount_type must be 'percent' or 'fixed'" });
  }
  if (discount_value === undefined || Number(discount_value) <= 0) {
    return res.status(400).json({ error: "Discount value must be greater than 0" });
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  if (expires_at && expires_at < todayStr) {
    return res.status(400).json({ error: "Expiry date can't be in the past" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO vouchers
         (code, label, discount_type, discount_value, max_discount_cap, min_order_amount, max_uses, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        code.trim().toUpperCase(),
        label?.trim() || null,
        discount_type,
        Number(discount_value),
        max_discount_cap ? Number(max_discount_cap) : null,
        min_order_amount ? Number(min_order_amount) : 0,
        max_uses ? Number(max_uses) : null,
        expires_at || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "A voucher with this code already exists" });
    throw err;
  }
});

router.patch("/vouchers/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { id } = req.params;
  const {
    label, discount_type, discount_value, max_discount_cap,
    min_order_amount, max_uses, expires_at, is_active,
  } = req.body;

  if (discount_type && !["percent", "fixed"].includes(discount_type)) {
    return res.status(400).json({ error: "discount_type must be 'percent' or 'fixed'" });
  }

  if (expires_at) {
    const existing = await pool.query("SELECT expires_at FROM vouchers WHERE id = $1", [id]);
    const existingDate = existing.rows[0]?.expires_at
      ? new Date(existing.rows[0].expires_at).toISOString().slice(0, 10)
      : null;
    const todayStr = new Date().toISOString().slice(0, 10);
    if (expires_at < todayStr && expires_at !== existingDate) {
      return res.status(400).json({ error: "Expiry date can't be in the past" });
    }
  }

  const result = await pool.query(
    `UPDATE vouchers SET
       label = COALESCE($1, label),
       discount_type = COALESCE($2, discount_type),
       discount_value = COALESCE($3, discount_value),
       max_discount_cap = $4,
       min_order_amount = COALESCE($5, min_order_amount),
       max_uses = $6,
       expires_at = $7,
       is_active = COALESCE($8, is_active)
     WHERE id = $9 RETURNING *`,
    [
      label?.trim() ?? null,
      discount_type ?? null,
      discount_value !== undefined ? Number(discount_value) : null,
      max_discount_cap !== undefined ? (max_discount_cap === null ? null : Number(max_discount_cap)) : null,
      min_order_amount !== undefined ? Number(min_order_amount) : null,
      max_uses !== undefined ? (max_uses === null ? null : Number(max_uses)) : null,
      expires_at !== undefined ? expires_at : null,
      is_active !== undefined ? is_active : null,
      id,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Voucher not found" });
  res.json(result.rows[0]);
});

router.delete("/vouchers/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  const result = await pool.query("DELETE FROM vouchers WHERE id = $1 RETURNING id", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Voucher not found" });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// Shared validation logic — used by /validate (preview, no auth)
// and by the public order route (server-enforced, on actual checkout).
// ─────────────────────────────────────────────
export async function validateVoucher(client, code, orderAmount) {
  if (!code?.trim()) return { error: "Voucher code is required", status: 400 };

  const result = await client.query(
    "SELECT * FROM vouchers WHERE code = $1",
    [code.trim().toUpperCase()]
  );
  const voucher = result.rows[0];
  if (!voucher) return { error: "Invalid voucher code", status: 404 };
  if (!voucher.is_active) return { error: "This voucher is no longer active", status: 400 };
  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
    return { error: "This voucher has expired", status: 400 };
  }
  if (voucher.max_uses !== null && voucher.used_count >= voucher.max_uses) {
    return { error: "This voucher has reached its usage limit", status: 400 };
  }
  if (Number(orderAmount) < Number(voucher.min_order_amount)) {
    return {
      error: `Minimum order of Rs. ${Number(voucher.min_order_amount).toLocaleString()} required for this voucher`,
      status: 400,
    };
  }

  let discount = voucher.discount_type === "percent"
    ? Math.round(Number(orderAmount) * (Number(voucher.discount_value) / 100))
    : Number(voucher.discount_value);

  if (voucher.max_discount_cap !== null) {
    discount = Math.min(discount, Number(voucher.max_discount_cap));
  }
  discount = Math.min(discount, Number(orderAmount));

  return { voucher, discount };
}

router.post("/vouchers/validate", async (req, res) => {
  const { code, order_amount } = req.body;
  if (order_amount === undefined || Number(order_amount) <= 0) {
    return res.status(400).json({ error: "A valid order amount is required" });
  }

  const { error, status, discount } = await validateVoucher(pool, code, order_amount);
  if (error) return res.status(status).json({ error });

  res.json({ discount_amount: discount });
});

export default router;
