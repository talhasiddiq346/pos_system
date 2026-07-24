// One-off: upload a "Tandoor" wordmark logo to Cloudinary and set it as the
// site logo, plus seed one cover image per category for every branch
// (category_images table — powers the image-bubble category pills on the site).
//
// Run: node scripts/seed-branding-categories.js
// Run against prod: DATABASE_URL=<prod url> node scripts/seed-branding-categories.js

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { uploadToCloudinary } from "../lib/cloudinary.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_SVG_PATH = process.env.LOGO_SVG_PATH || path.join(__dirname, "assets/tandoor-logo.svg");
const BANNER_SVG_PATH = process.env.BANNER_SVG_PATH || path.join(__dirname, "assets/tandoor-banner.svg");

const CATEGORY_IMAGES = {
  "Burgers & Sandwiches": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80",
  Pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80",
  "Sides & Appetizers": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&q=80",
  Pasta: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500&q=80",
  "BBQ & Karahi": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&q=80",
  Beverages: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&q=80",
  Desserts: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&q=80",
};

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Logo + banner → Cloudinary → site_settings
    const logoBuffer = fs.readFileSync(LOGO_SVG_PATH);
    const { url: logoUrl } = await uploadToCloudinary(logoBuffer, "tandoor/branding");
    console.log("Logo uploaded:", logoUrl);

    const bannerBuffer = fs.readFileSync(BANNER_SVG_PATH);
    const { url: bannerUrl, publicId: bannerPublicId } = await uploadToCloudinary(bannerBuffer, "tandoor/banners");
    console.log("Banner uploaded:", bannerUrl);

    await client.query(
      `UPDATE site_settings
       SET logo_url = $1,
           banner_images = $2::jsonb,
           updated_at = now()
       WHERE id = 1`,
      [logoUrl, JSON.stringify([{ image_url: bannerUrl, public_id: bannerPublicId, link: null }])]
    );

    // 2. Category cover images, one per branch.
    const { rows: branches } = await client.query("SELECT id, name FROM branches");
    let inserted = 0;
    for (const branch of branches) {
      for (const [category, imageUrl] of Object.entries(CATEGORY_IMAGES)) {
        await client.query(
          `INSERT INTO category_images (branch_id, name, image_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (branch_id, name) DO UPDATE SET image_url = EXCLUDED.image_url`,
          [branch.id, category, imageUrl]
        );
        inserted++;
      }
    }
    console.log(`Category images upserted: ${inserted} (${branches.length} branches x ${Object.keys(CATEGORY_IMAGES).length} categories)`);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed, rolled back:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
