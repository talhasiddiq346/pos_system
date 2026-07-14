import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { PRODUCTS_UPLOAD_DIR } from "../middleware/upload.js";
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from "../lib/cloudinary.js";

const router = Router();

// ─────────────────────────────────────────────
// MEMORY STORAGE multer for Cloudinary uploads
// (files stay in RAM as Buffer, streamed to Cloudinary)
// ─────────────────────────────────────────────
const cloudUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG/PNG/WebP images allowed"));
  },
});

// ─────────────────────────────────────────────
// SMART DELETE — handles both Cloudinary and legacy local files
// ─────────────────────────────────────────────
async function deleteProductImage(imageUrl, imagePublicId) {
  if (!imageUrl) return;

  // Case 1: Cloudinary URL (starts with http)
  if (imageUrl.startsWith("http")) {
    const publicId = imagePublicId || extractPublicId(imageUrl);
    if (publicId) {
      await deleteFromCloudinary(publicId);
    }
    return;
  }

  // Case 2: Legacy local file (starts with /uploads/)
  const filename = path.basename(imageUrl);
  const filePath = path.join(PRODUCTS_UPLOAD_DIR, filename);
  fs.unlink(filePath, () => {}); // ignore errors
}

// ═══════════════════════════════════════════════════
// GET all products
// ═══════════════════════════════════════════════════
router.get(
  "/",
  requireAuth,
  requireRole("super_admin", "branch_admin", "cashier", "call_center", "chef"),
  async (req, res) => {
    let products;

    if (["branch_admin", "cashier", "chef"].includes(req.user.role)) {
      const result = await pool.query(
        "SELECT * FROM products WHERE branch_id = $1 ORDER BY id",
        [req.user.branch_id]
      );
      products = result.rows;
    } else {
      const { branch_id } = req.query;
      if (branch_id) {
        const result = await pool.query(
          "SELECT * FROM products WHERE branch_id = $1 ORDER BY id",
          [branch_id]
        );
        products = result.rows;
      } else {
        const result = await pool.query("SELECT * FROM products ORDER BY branch_id, id");
        products = result.rows;
      }
    }

    if (products.length === 0) return res.json([]);

    const ids = products.map((p) => p.id);
    const variantsResult = await pool.query(
      "SELECT * FROM product_variants WHERE product_id = ANY($1::int[]) ORDER BY id",
      [ids]
    );

    const variantsByProduct = {};
    for (const v of variantsResult.rows) {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
      variantsByProduct[v.product_id].push(v);
    }

    res.json(products.map((p) => ({ ...p, variants: variantsByProduct[p.id] || [] })));
  }
);

// ═══════════════════════════════════════════════════
// GET categories for a branch
// ═══════════════════════════════════════════════════
router.get("/categories/:branchId", requireAuth, async (req, res) => {
  const { branchId } = req.params;

  if (req.user.role === "branch_admin" && req.user.branch_id !== Number(branchId)) {
    return res.status(403).json({ error: "Access denied" });
  }

  const result = await pool.query(
    `SELECT DISTINCT category FROM products
     WHERE branch_id = $1 AND category IS NOT NULL AND category != ''
     ORDER BY category`,
    [branchId]
  );
  res.json(result.rows.map((r) => r.category));
});

// ═══════════════════════════════════════════════════
// POST create product (no image yet)
// ═══════════════════════════════════════════════════
router.post("/", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { name, price, category, branch_id } = req.body;
  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: "Name and price are required" });
  }
  if (Number(price) < 0) {
    return res.status(400).json({ error: "Price cannot be negative" });
  }

  const finalBranchId = req.user.role === "branch_admin" ? req.user.branch_id : branch_id;
  if (!finalBranchId) return res.status(400).json({ error: "Branch is required" });

  const result = await pool.query(
    `INSERT INTO products (branch_id, name, price, category)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [finalBranchId, name, price, category || null]
  );
  res.status(201).json({ ...result.rows[0], variants: [] });
});

// ═══════════════════════════════════════════════════
// PATCH update product
// ═══════════════════════════════════════════════════
router.patch("/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const { name, price, category, is_available } = req.body;

  const existing = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Product not found" });
  const product = existing.rows[0];

  if (req.user.role === "branch_admin" && product.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  if (price !== undefined && Number(price) < 0) {
    return res.status(400).json({ error: "Price cannot be negative" });
  }

  const result = await pool.query(
    `UPDATE products SET
       name = COALESCE($1, name),
       price = COALESCE($2, price),
       category = COALESCE($3, category),
       is_available = COALESCE($4, is_available)
     WHERE id = $5 RETURNING *`,
    [name ?? null, price ?? null, category ?? null, is_available ?? null, id]
  );
  res.json(result.rows[0]);
});

// ═══════════════════════════════════════════════════
// DELETE product (also deletes image from Cloudinary or local disk)
// ═══════════════════════════════════════════════════
router.delete("/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;

  const existing = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Product not found" });
  const product = existing.rows[0];

  if (req.user.role === "branch_admin" && product.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  await pool.query("DELETE FROM products WHERE id = $1", [id]);
  await deleteProductImage(product.image_url, product.image_public_id);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// ⭐ IMAGE UPLOAD — now goes to Cloudinary
// ═══════════════════════════════════════════════════
router.post(
  "/:id/image",
  requireAuth,
  requireRole("super_admin", "branch_admin"),
  cloudUpload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: "Product not found" });
      const product = existing.rows[0];

      if (req.user.role === "branch_admin" && product.branch_id !== req.user.branch_id) {
        return res.status(403).json({ error: "You can only manage your own branch's products" });
      }

      if (!req.file) return res.status(400).json({ error: "No image file received" });

      // Upload to Cloudinary
      const { url, publicId } = await uploadToCloudinary(req.file.buffer, "tandoor/products");

      // Update DB with new URL + public_id
      const result = await pool.query(
        `UPDATE products SET image_url = $1, image_public_id = $2 WHERE id = $3 RETURNING *`,
        [url, publicId, id]
      );

      // Delete old image (Cloudinary or local, handled by helper)
      await deleteProductImage(product.image_url, product.image_public_id);

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Image upload error:", err);
      if (err.message?.includes("images allowed")) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: "Image upload failed" });
    }
  }
);

// ═══════════════════════════════════════════════════
// DELETE product image
// ═══════════════════════════════════════════════════
router.delete("/:id/image", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;

  const existing = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Product not found" });
  const product = existing.rows[0];

  if (req.user.role === "branch_admin" && product.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  const result = await pool.query(
    `UPDATE products SET image_url = NULL, image_public_id = NULL WHERE id = $1 RETURNING *`,
    [id]
  );

  await deleteProductImage(product.image_url, product.image_public_id);
  res.json(result.rows[0]);
});

// ═══════════════════════════════════════════════════
// ─── VARIANTS ─── (unchanged)
// ═══════════════════════════════════════════════════

async function getVariantWithBranch(id) {
  const result = await pool.query(
    `SELECT pv.*, p.branch_id FROM product_variants pv
     JOIN products p ON p.id = pv.product_id WHERE pv.id = $1`,
    [id]
  );
  return result.rows[0];
}

router.post("/:productId/variants", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { productId } = req.params;
  const { name, price } = req.body;
  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: "Variant name and price are required" });
  }
  if (Number(price) < 0) return res.status(400).json({ error: "Price cannot be negative" });

  const productResult = await pool.query("SELECT * FROM products WHERE id = $1", [productId]);
  if (productResult.rows.length === 0) return res.status(404).json({ error: "Product not found" });
  const product = productResult.rows[0];

  if (req.user.role === "branch_admin" && product.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  const result = await pool.query(
    `INSERT INTO product_variants (product_id, name, price) VALUES ($1, $2, $3) RETURNING *`,
    [productId, name, price]
  );
  res.status(201).json(result.rows[0]);
});

router.patch("/variants/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const { name, price, is_available } = req.body;

  const variant = await getVariantWithBranch(id);
  if (!variant) return res.status(404).json({ error: "Variant not found" });

  if (req.user.role === "branch_admin" && variant.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  if (price !== undefined && Number(price) < 0) {
    return res.status(400).json({ error: "Price cannot be negative" });
  }

  const result = await pool.query(
    `UPDATE product_variants SET
       name = COALESCE($1, name),
       price = COALESCE($2, price),
       is_available = COALESCE($3, is_available)
     WHERE id = $4 RETURNING *`,
    [name ?? null, price ?? null, is_available ?? null, id]
  );
  res.json(result.rows[0]);
});

router.delete("/variants/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;

  const variant = await getVariantWithBranch(id);
  if (!variant) return res.status(404).json({ error: "Variant not found" });

  if (req.user.role === "branch_admin" && variant.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  await pool.query("DELETE FROM product_variants WHERE id = $1", [id]);
  res.json({ ok: true });
});

export default router;