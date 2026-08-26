/**
 * Storage Provider Abstraction
 *
 * Switches between two upload backends based on the STORAGE_PROVIDER env var:
 *
 *   STORAGE_PROVIDER=local      → saves files to backend/uploads/products/ (default)
 *   STORAGE_PROVIDER=cloudinary → streams files to Cloudinary, returns a CDN URL
 *
 * Both providers expose the same interface:
 *
 *   provider.multerStorage   — multer storage engine to pass to multer()
 *   provider.getImageUrl(req) — extracts the final public URL from req.file
 *   provider.deleteImage(url) — deletes an image by its stored URL/public_id
 */

const path = require('path');
const fs   = require('fs');

const PROVIDER = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

// ─── Local Provider ───────────────────────────────────────────────────────────
function buildLocalProvider() {
  const multer   = require('multer');
  const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'products');

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const multerStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename:    (_req, file, cb) => {
      const ext      = path.extname(file.originalname).toLowerCase();
      const baseName = path.basename(file.originalname, ext)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      cb(null, `${Date.now()}-${baseName || 'product'}${ext}`);
    },
  });

  /**
   * Returns the relative URL that gets stored in the database.
   * e.g. /uploads/products/1234567890-avocado.jpg
   */
  function getImageUrl(req) {
    if (!req.file) return null;
    return `/uploads/products/${req.file.filename}`;
  }

  /**
   * Deletes a locally stored image given its stored URL.
   * Silently ignores missing files.
   */
  function deleteImage(imageUrl) {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
    const filePath = path.join(__dirname, '..', imageUrl);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.warn('[storage:local] Failed to delete file:', filePath, err.message);
      }
    });
  }

  return { name: 'local', multerStorage, getImageUrl, deleteImage };
}

// ─── Cloudinary Provider ──────────────────────────────────────────────────────
function buildCloudinaryProvider() {
  const multer     = require('multer');
  const cloudinary = require('cloudinary').v2;
  const { Readable } = require('stream');

  // Configure Cloudinary from env vars
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
  });

  // Validate that all required env vars are present at startup
  const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
    .filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `[storage:cloudinary] Missing required env vars: ${missing.join(', ')}.\n` +
      'Set them in your .env file or switch STORAGE_PROVIDER=local.'
    );
  }

  // Use memory storage — multer buffers the file, then we stream it to Cloudinary
  const multerStorage = multer.memoryStorage();

  /**
   * Uploads req.file.buffer to Cloudinary and attaches the result to req.file.
   * Must be called as middleware AFTER multer has run.
   *
   * Sets req.file.cloudinaryUrl   — the CDN HTTPS URL
   *     req.file.cloudinaryPublicId — public_id for future deletions
   */
  async function uploadToCloudinary(req) {
    if (!req.file) return;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder:         'ganaheza/products',
          resource_type:  'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          req.file.cloudinaryUrl      = result.secure_url;
          req.file.cloudinaryPublicId = result.public_id;
          resolve(result);
        }
      );

      // Convert buffer to a readable stream and pipe into Cloudinary
      const readable = new Readable();
      readable.push(req.file.buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  /**
   * Returns the Cloudinary CDN URL attached by uploadToCloudinary().
   */
  function getImageUrl(req) {
    return req.file?.cloudinaryUrl || null;
  }

  /**
   * Deletes a Cloudinary image by its stored CDN URL.
   * Extracts the public_id from the URL and calls cloudinary.uploader.destroy().
   */
  async function deleteImage(imageUrl) {
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) return;
    try {
      // public_id is the path between /upload/v<version>/ and the file extension
      // e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/ganaheza/products/abc.jpg
      //   → public_id = ganaheza/products/abc
      const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
      if (!match) return;
      const publicId = match[1];
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.warn('[storage:cloudinary] Failed to delete image:', imageUrl, err.message);
    }
  }

  return { name: 'cloudinary', multerStorage, uploadToCloudinary, getImageUrl, deleteImage };
}

// ─── Build and export the active provider ─────────────────────────────────────
let provider;

if (PROVIDER === 'cloudinary') {
  provider = buildCloudinaryProvider();
} else {
  if (PROVIDER !== 'local') {
    console.warn(
      `[storage] Unknown STORAGE_PROVIDER="${PROVIDER}". Falling back to "local".`
    );
  }
  provider = buildLocalProvider();
}

console.log(`[storage] Provider: ${provider.name}`);

module.exports = provider;
