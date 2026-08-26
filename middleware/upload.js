/**
 * Multer upload middleware.
 *
 * Storage engine is determined by the active provider in services/storage.js:
 *   STORAGE_PROVIDER=local      → disk storage (backend/uploads/products/)
 *   STORAGE_PROVIDER=cloudinary → memory storage (buffer streamed to Cloudinary)
 *
 * File filter and size limit apply to both providers.
 */

const multer  = require('multer');
const storage = require('../services/storage');

// File filter — only allow images
const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.'), false);
  }
};

const upload = multer({
  storage: storage.multerStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});

module.exports = upload;
