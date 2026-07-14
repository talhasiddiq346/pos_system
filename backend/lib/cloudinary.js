// ═══════════════════════════════════════════════════
// Cloudinary — Image storage for products
// ═══════════════════════════════════════════════════
//
// Setup:
//   1. cd backend && npm install cloudinary multer
//   2. Add 3 env vars to .env:
//      CLOUDINARY_CLOUD_NAME=xxx
//      CLOUDINARY_API_KEY=xxx
//      CLOUDINARY_API_SECRET=xxx   ← NEVER commit or share
//
// Usage:
//   import { uploadToCloudinary, deleteFromCloudinary } from "../lib/cloudinary.js";
//   const url = await uploadToCloudinary(file.buffer, "products");
//   await deleteFromCloudinary(publicId);

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload an image buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} folder - Cloudinary folder (e.g. "tandoor/products")
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export function uploadToCloudinary(buffer, folder = "tandoor/products") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        // Auto optimize: WebP conversion, compression
        transformation: [
          { quality: "auto:good" },
          { fetch_format: "auto" },
          // Optional: resize huge uploads to max 1200px wide
          { width: 1200, crop: "limit" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Delete an image from Cloudinary using its public_id.
 * Public ID is stored in DB alongside the URL when uploading.
 */
export async function deleteFromCloudinary(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete failed:", err.message);
    // Non-fatal — image just stays in Cloudinary
  }
}

/**
 * Extract public_id from a full Cloudinary URL.
 * Useful if you only stored the URL (not public_id) in DB.
 *
 * Example:
 *   https://res.cloudinary.com/xxx/image/upload/v1234/tandoor/products/abc.jpg
 *   → tandoor/products/abc
 */
export function extractPublicId(url) {
  if (!url) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.(jpg|jpeg|png|webp|gif)$/i);
  return match ? match[1] : null;
}

export default cloudinary;