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

  // LEFT/FULL join so a category with a picture but no products yet still shows up.
  const result = await pool.query(
    `SELECT COALESCE(p.category, ci.name) AS name,
            COALESCE(p.count, 0)::int AS count,
            ci.image_url
     FROM (
       SELECT category, COUNT(*) AS count
       FROM products
       WHERE branch_id = $1 AND category IS NOT NULL AND category != ''
       GROUP BY category
     ) p
     FULL OUTER JOIN category_images ci ON ci.name = p.category AND ci.branch_id = $1
     ORDER BY name`,
    [branchId]
  );
  res.json(result.rows);
});

router.post(
  "/categories/:branchId/image",
  requireAuth,
  requireRole("super_admin", "branch_admin"),
  cloudUpload.single("image"),
  async (req, res) => {
    const { branchId } = req.params;
    const { name } = req.body;

    if (req.user.role === "branch_admin" && req.user.branch_id !== Number(branchId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!name?.trim()) return res.status(400).json({ error: "Category name is required" });
    if (!req.file) return res.status(400).json({ error: "No image file received" });

    try {
      const existing = await pool.query(
        "SELECT image_public_id FROM category_images WHERE branch_id = $1 AND name = $2",
        [branchId, name.trim()]
      );

      const { url, publicId } = await uploadToCloudinary(req.file.buffer, "tandoor/categories");
      const result = await pool.query(
        `INSERT INTO category_images (branch_id, name, image_url, image_public_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (branch_id, name) DO UPDATE SET image_url = $3, image_public_id = $4
         RETURNING *`,
        [branchId, name.trim(), url, publicId]
      );

      if (existing.rows[0]?.image_public_id) await deleteFromCloudinary(existing.rows[0].image_public_id);
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Category image upload error:", err);
      res.status(500).json({ error: "Image upload failed" });
    }
  }
);

router.delete(
  "/categories/:branchId/:name/image",
  requireAuth,
  requireRole("super_admin", "branch_admin"),
  async (req, res) => {
    const { branchId, name } = req.params;
    if (req.user.role === "branch_admin" && req.user.branch_id !== Number(branchId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const decodedName = decodeURIComponent(name);
    const existing = await pool.query(
      "SELECT image_public_id FROM category_images WHERE branch_id = $1 AND name = $2",
      [branchId, decodedName]
    );
    await pool.query(
      `UPDATE category_images SET image_url = NULL, image_public_id = NULL
       WHERE branch_id = $1 AND name = $2`,
      [branchId, decodedName]
    );
    if (existing.rows[0]?.image_public_id) await deleteFromCloudinary(existing.rows[0].image_public_id);
    res.json({ ok: true });
  }
);

router.patch(
  "/categories/:branchId/rename",
  requireAuth,
  requireRole("super_admin", "branch_admin"),
  async (req, res) => {
    const { branchId } = req.params;
    const { old_name, new_name } = req.body;
 
    if (req.user.role === "branch_admin" && req.user.branch_id !== Number(branchId)) {
      return res.status(403).json({ error: "Access denied" });
    }
 
    if (!old_name || !new_name?.trim()) {
      return res.status(400).json({ error: "Old and new category names are required" });
    }
 
    const trimmedNew = new_name.trim();
 
    // Check if new name already exists (different from old) for this branch
    const dup = await pool.query(
      `SELECT 1 FROM products
       WHERE branch_id = $1 AND LOWER(category) = LOWER($2) AND category != $3
       LIMIT 1`,
      [branchId, trimmedNew, old_name]
    );
    if (dup.rowCount > 0) {
      return res.status(400).json({ error: `Category "${trimmedNew}" already exists` });
    }
 
    const result = await pool.query(
      `UPDATE products SET category = $1
       WHERE branch_id = $2 AND category = $3
       RETURNING id`,
      [trimmedNew, branchId, old_name]
    );

    // Carry the picture over to the new name (skip if the new name already has one).
    await pool.query(
      `UPDATE category_images SET name = $1
       WHERE branch_id = $2 AND name = $3
         AND NOT EXISTS (SELECT 1 FROM category_images WHERE branch_id = $2 AND name = $1)`,
      [trimmedNew, branchId, old_name]
    );

    res.json({ ok: true, updated: result.rowCount });
  }
);

router.delete(
  "/categories/:branchId/:name",
  requireAuth,
  requireRole("super_admin", "branch_admin"),
  async (req, res) => {
    const { branchId, name } = req.params;

    if (req.user.role === "branch_admin" && req.user.branch_id !== Number(branchId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const decodedName = decodeURIComponent(name);

    const result = await pool.query(
      `UPDATE products SET category = NULL
       WHERE branch_id = $1 AND category = $2
       RETURNING id`,
      [branchId, decodedName]
    );

    const removedImage = await pool.query(
      `DELETE FROM category_images WHERE branch_id = $1 AND name = $2 RETURNING image_public_id`,
      [branchId, decodedName]
    );
    if (removedImage.rows[0]?.image_public_id) await deleteFromCloudinary(removedImage.rows[0].image_public_id);

    res.json({ ok: true, affected: result.rowCount });
  }
);
 
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
  const { name, price, category, is_available, is_popular } = req.body;

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
       is_available = COALESCE($4, is_available),
       is_popular = COALESCE($5, is_popular)
     WHERE id = $6 RETURNING *`,
    [name ?? null, price ?? null, category ?? null, is_available ?? null, is_popular ?? null, id]
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
 
  // ── Shared image protection
  // Only delete from Cloudinary if NO OTHER product uses the same image
  if (product.image_public_id) {
    const others = await pool.query(
      "SELECT id FROM products WHERE image_public_id = $1 LIMIT 1",
      [product.image_public_id]
    );
    if (others.rowCount === 0) {
      // No other product uses this image — safe to delete from Cloudinary
      await deleteProductImage(product.image_url, product.image_public_id);
    }
    // else: shared image, leave it in Cloudinary
  } else if (product.image_url) {
    // Legacy local file — just delete
    await deleteProductImage(product.image_url, null);
  }
 
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
router.post(
  "/bulk",
  requireAuth,
  requireRole("super_admin"),
  cloudUpload.single("image"),
  async (req, res) => {
    try {
      const { name, price, category, branch_ids } = req.body;
 
      // Parse branch_ids (comes as JSON string from FormData)
      let branchIds;
      try {
        branchIds = typeof branch_ids === "string" ? JSON.parse(branch_ids) : branch_ids;
      } catch {
        return res.status(400).json({ error: "Invalid branch_ids format" });
      }
 
      if (!Array.isArray(branchIds) || branchIds.length === 0) {
        return res.status(400).json({ error: "At least one branch is required" });
      }
 
      if (!name || price === undefined || price === null) {
        return res.status(400).json({ error: "Name and price are required" });
      }
 
      if (Number(price) < 0) {
        return res.status(400).json({ error: "Price cannot be negative" });
      }
 
      // Verify all branch IDs exist
      const branchCheck = await pool.query(
        "SELECT id FROM branches WHERE id = ANY($1::int[])",
        [branchIds]
      );
      if (branchCheck.rowCount !== branchIds.length) {
        return res.status(400).json({ error: "One or more branches don't exist" });
      }
 
      // ── Upload image ONCE to Cloudinary (if provided)
      let imageUrl = null;
      let imagePublicId = null;
      if (req.file) {
        const uploaded = await uploadToCloudinary(req.file.buffer, "tandoor/products");
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;
      }
 
      // ── Insert into each branch
      const created = [];
      for (const bid of branchIds) {
        const result = await pool.query(
          `INSERT INTO products (branch_id, name, price, category, image_url, image_public_id)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [bid, name, Number(price), category?.trim() || null, imageUrl, imagePublicId]
        );
        created.push(result.rows[0]);
      }
 
      res.status(201).json({
        ok: true,
        count: created.length,
        products: created,
      });
    } catch (err) {
      console.error("Bulk product create error:", err);
      if (err.message?.includes("images allowed")) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: "Server error" });
    }
  }
);
 

export default router;