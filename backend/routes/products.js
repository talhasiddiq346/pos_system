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
// Fetch addon groups (+ nested options) for a set of products, keyed by product_id
// ─────────────────────────────────────────────
export async function getAddonGroupsByProduct(productIds) {
  if (productIds.length === 0) return {};

  const groupsRes = await pool.query(
    "SELECT * FROM addon_groups WHERE product_id = ANY($1::int[]) ORDER BY sort_order, id",
    [productIds]
  );
  const groupIds = groupsRes.rows.map((g) => g.id);

  const optionsRes = groupIds.length
    ? await pool.query(
        "SELECT * FROM addon_options WHERE group_id = ANY($1::int[]) ORDER BY sort_order, id",
        [groupIds]
      )
    : { rows: [] };

  const optionsByGroup = {};
  for (const o of optionsRes.rows) {
    if (!optionsByGroup[o.group_id]) optionsByGroup[o.group_id] = [];
    optionsByGroup[o.group_id].push(o);
  }

  const groupsByProduct = {};
  for (const g of groupsRes.rows) {
    if (!groupsByProduct[g.product_id]) groupsByProduct[g.product_id] = [];
    groupsByProduct[g.product_id].push({ ...g, options: optionsByGroup[g.id] || [] });
  }
  return groupsByProduct;
}

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

    const addonGroupsByProduct = await getAddonGroupsByProduct(ids);

    res.json(products.map((p) => ({
      ...p,
      variants: variantsByProduct[p.id] || [],
      addon_groups: addonGroupsByProduct[p.id] || [],
    })));
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
  // ci must be pre-filtered to this branch in a subquery — filtering only in the ON
  // clause lets unmatched category_images rows from OTHER branches leak into the
  // FULL OUTER JOIN result whenever their name happens to collide.
  const result = await pool.query(
    `SELECT COALESCE(p.category, ci.name) AS name,
            COALESCE(p.count, 0)::int AS count,
            ci.image_url,
            COALESCE(ci.sort_order, 999999) AS sort_order
     FROM (
       SELECT category, COUNT(*) AS count
       FROM products
       WHERE branch_id = $1 AND category IS NOT NULL AND category != ''
       GROUP BY category
     ) p
     FULL OUTER JOIN (
       SELECT name, image_url, sort_order FROM category_images WHERE branch_id = $1
     ) ci ON ci.name = p.category
     ORDER BY sort_order, name`,
    [branchId]
  );
  res.json(result.rows);
});

// ═══════════════════════════════════════════════════
// PATCH reorder categories for a branch
// ═══════════════════════════════════════════════════
router.patch("/categories/:branchId/reorder", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { branchId } = req.params;
  const { names } = req.body;

  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: "names must be a non-empty array" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < names.length; i++) {
      await client.query(
        `INSERT INTO category_images (branch_id, name, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (branch_id, name) DO UPDATE SET sort_order = $3`,
        [branchId, names[i], i]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reorder categories failed:", err.message);
    res.status(500).json({ error: "Failed to reorder categories" });
  } finally {
    client.release();
  }
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
  const { name, price, category, branch_id, discounted_price, description } = req.body;
  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: "Name and price are required" });
  }
  if (Number(price) < 0) {
    return res.status(400).json({ error: "Price cannot be negative" });
  }
  if (discounted_price !== undefined && discounted_price !== null && Number(discounted_price) >= Number(price)) {
    return res.status(400).json({ error: "Discounted price must be lower than the actual price" });
  }

  const finalBranchId = req.user.role === "branch_admin" ? req.user.branch_id : branch_id;
  if (!finalBranchId) return res.status(400).json({ error: "Branch is required" });

  const result = await pool.query(
    `INSERT INTO products (branch_id, name, price, category, discounted_price, description)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [finalBranchId, name, price, category || null, discounted_price ? Number(discounted_price) : null, description || null]
  );
  res.status(201).json({ ...result.rows[0], variants: [] });
});

// ═══════════════════════════════════════════════════
// PATCH update product
// ═══════════════════════════════════════════════════
router.patch("/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const { name, price, category, is_available, is_popular, discounted_price, description, is_out_of_stock } = req.body;

  const existing = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Product not found" });
  const product = existing.rows[0];

  if (req.user.role === "branch_admin" && product.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  if (price !== undefined && Number(price) < 0) {
    return res.status(400).json({ error: "Price cannot be negative" });
  }

  const finalPrice = price !== undefined && price !== null ? Number(price) : Number(product.price);
  if (discounted_price !== undefined && discounted_price !== null && Number(discounted_price) >= finalPrice) {
    return res.status(400).json({ error: "Discounted price must be lower than the actual price" });
  }

  const result = await pool.query(
    `UPDATE products SET
       name = COALESCE($1, name),
       price = COALESCE($2, price),
       category = COALESCE($3, category),
       is_available = COALESCE($4, is_available),
       is_popular = COALESCE($5, is_popular),
       discounted_price = $6,
       description = COALESCE($7, description),
       is_out_of_stock = COALESCE($8, is_out_of_stock)
     WHERE id = $9 RETURNING *`,
    [
      name ?? null, price ?? null, category ?? null, is_available ?? null, is_popular ?? null,
      discounted_price !== undefined ? (discounted_price === null ? null : Number(discounted_price)) : product.discounted_price,
      description ?? null,
      is_out_of_stock ?? null,
      id,
    ]
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
// COPY product (+ variants + addon groups/options) to another branch
// ═══════════════════════════════════════════════════
router.post("/:id/copy-to-branch", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { id } = req.params;
  const { branch_id } = req.body;
  if (!branch_id) return res.status(400).json({ error: "Target branch is required" });

  const client = await pool.connect();
  try {
    const productRes = await client.query("SELECT * FROM products WHERE id = $1", [id]);
    if (productRes.rows.length === 0) return res.status(404).json({ error: "Product not found" });
    const product = productRes.rows[0];

    if (Number(branch_id) === product.branch_id) {
      return res.status(400).json({ error: "Product already belongs to this branch" });
    }

    const branchRes = await client.query("SELECT id FROM branches WHERE id = $1", [branch_id]);
    if (branchRes.rows.length === 0) return res.status(404).json({ error: "Target branch not found" });

    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO products (branch_id, name, price, discounted_price, category, description, image_url, image_public_id, is_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING *`,
      [branch_id, product.name, product.price, product.discounted_price, product.category, product.description, product.image_url, product.image_public_id]
    );
    const newProduct = inserted.rows[0];

    const variants = await client.query("SELECT * FROM product_variants WHERE product_id = $1", [id]);
    for (const v of variants.rows) {
      await client.query(
        `INSERT INTO product_variants (product_id, name, price, is_available) VALUES ($1,$2,$3,$4)`,
        [newProduct.id, v.name, v.price, v.is_available]
      );
    }

    const groups = await client.query("SELECT * FROM addon_groups WHERE product_id = $1", [id]);
    for (const g of groups.rows) {
      const newGroup = await client.query(
        `INSERT INTO addon_groups (product_id, title, selection_type, required, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [newProduct.id, g.title, g.selection_type, g.required, g.sort_order]
      );
      const options = await client.query("SELECT * FROM addon_options WHERE group_id = $1", [g.id]);
      for (const o of options.rows) {
        await client.query(
          `INSERT INTO addon_options (group_id, name, price, is_available, sort_order) VALUES ($1,$2,$3,$4,$5)`,
          [newGroup.rows[0].id, o.name, o.price, o.is_available, o.sort_order]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json(newProduct);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Copy product to branch failed:", err.message);
    res.status(500).json({ error: "Failed to copy product" });
  } finally {
    client.release();
  }
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

// ═══════════════════════════════════════════════════
// ─── ADDON GROUPS (e.g. "Choose Patty", "Add Cheese") ───
// ═══════════════════════════════════════════════════

async function getGroupWithBranch(id) {
  const result = await pool.query(
    `SELECT ag.*, p.branch_id FROM addon_groups ag
     JOIN products p ON p.id = ag.product_id WHERE ag.id = $1`,
    [id]
  );
  return result.rows[0];
}

async function getOptionWithBranch(id) {
  const result = await pool.query(
    `SELECT ao.*, ag.product_id, p.branch_id FROM addon_options ao
     JOIN addon_groups ag ON ag.id = ao.group_id
     JOIN products p ON p.id = ag.product_id WHERE ao.id = $1`,
    [id]
  );
  return result.rows[0];
}

router.post("/:productId/addon-groups", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { productId } = req.params;
  const { title, selection_type, required } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: "Group title is required" });
  if (!["single", "multiple"].includes(selection_type)) {
    return res.status(400).json({ error: "selection_type must be 'single' or 'multiple'" });
  }

  const productResult = await pool.query("SELECT * FROM products WHERE id = $1", [productId]);
  if (productResult.rows.length === 0) return res.status(404).json({ error: "Product not found" });
  const product = productResult.rows[0];

  if (req.user.role === "branch_admin" && product.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  const result = await pool.query(
    `INSERT INTO addon_groups (product_id, title, selection_type, required)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [productId, title.trim(), selection_type, !!required]
  );
  res.status(201).json({ ...result.rows[0], options: [] });
});

router.patch("/addon-groups/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const { title, selection_type, required } = req.body;

  const group = await getGroupWithBranch(id);
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (req.user.role === "branch_admin" && group.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }
  if (selection_type && !["single", "multiple"].includes(selection_type)) {
    return res.status(400).json({ error: "selection_type must be 'single' or 'multiple'" });
  }

  const result = await pool.query(
    `UPDATE addon_groups SET
       title = COALESCE($1, title),
       selection_type = COALESCE($2, selection_type),
       required = COALESCE($3, required)
     WHERE id = $4 RETURNING *`,
    [title?.trim() ?? null, selection_type ?? null, required ?? null, id]
  );
  res.json(result.rows[0]);
});

router.delete("/addon-groups/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const group = await getGroupWithBranch(id);
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (req.user.role === "branch_admin" && group.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  await pool.query("DELETE FROM addon_groups WHERE id = $1", [id]);
  res.json({ ok: true });
});

router.post("/addon-groups/:groupId/options", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { groupId } = req.params;
  const { name, price } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: "Option name is required" });
  if (price === undefined || Number(price) < 0) {
    return res.status(400).json({ error: "Price must be zero or greater" });
  }

  const group = await getGroupWithBranch(groupId);
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (req.user.role === "branch_admin" && group.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  const result = await pool.query(
    `INSERT INTO addon_options (group_id, name, price) VALUES ($1, $2, $3) RETURNING *`,
    [groupId, name.trim(), Number(price)]
  );
  res.status(201).json(result.rows[0]);
});

router.patch("/addon-options/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const { name, price, is_available } = req.body;

  const option = await getOptionWithBranch(id);
  if (!option) return res.status(404).json({ error: "Option not found" });
  if (req.user.role === "branch_admin" && option.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }
  if (price !== undefined && Number(price) < 0) {
    return res.status(400).json({ error: "Price cannot be negative" });
  }

  const result = await pool.query(
    `UPDATE addon_options SET
       name = COALESCE($1, name),
       price = COALESCE($2, price),
       is_available = COALESCE($3, is_available)
     WHERE id = $4 RETURNING *`,
    [name?.trim() ?? null, price ?? null, is_available ?? null, id]
  );
  res.json(result.rows[0]);
});

router.delete("/addon-options/:id", requireAuth, requireRole("super_admin", "branch_admin"), async (req, res) => {
  const { id } = req.params;
  const option = await getOptionWithBranch(id);
  if (!option) return res.status(404).json({ error: "Option not found" });
  if (req.user.role === "branch_admin" && option.branch_id !== req.user.branch_id) {
    return res.status(403).json({ error: "You can only manage your own branch's products" });
  }

  await pool.query("DELETE FROM addon_options WHERE id = $1", [id]);
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