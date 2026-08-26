const express = require('express');
const { body, validationResult } = require('express-validator');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');
const upload  = require('../middleware/upload');
const storage = require('../services/storage');

const router = express.Router();

// ─── Helper: format a product row from DB ─────────────────────────────────────
function formatProduct(row) {
  return {
    id:          String(row.id),
    code:        row.code,
    name:        row.name,
    category:    row.category,
    quantity:    row.quantity !== null ? Number(row.quantity) : null,
    unit:        row.unit,
    period:      row.period,
    price:       row.price !== null ? Number(row.price) : null,
    currency:    row.currency,
    priceUnit:   row.price_unit,
    status:      row.status,
    imageUrl:    row.image_url,
    description: row.description,
    location:    row.location,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ─── GET /api/products ────────────────────────────────────────────────────────
// Public. Supports ?category= and ?search=
router.get('/', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND LOWER(category) = LOWER($${params.length})`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ products: result.rows.map(formatProduct) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/products/:id ────────────────────────────────────────────────────
// Public.
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: formatProduct(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/products/upload ───────────────────────────────────────────────
// Protected (JWT required). Uploads a product image, returns the public URL.
// Works with both local disk storage and Cloudinary depending on STORAGE_PROVIDER.
router.post('/upload', requireAuth, upload.single('image'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  try {
    // Cloudinary provider: buffer is in memory — stream it up now
    if (storage.name === 'cloudinary') {
      await storage.uploadToCloudinary(req);
    }

    const imageUrl = storage.getImageUrl(req);
    res.json({
      message:  'Image uploaded successfully.',
      imageUrl,
      provider: storage.name,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/products ───────────────────────────────────────────────────────
// Protected (JWT required)
router.post(
  '/',
  requireAuth,
  [
    body('name').notEmpty().withMessage('Name is required.'),
    body('category').notEmpty().withMessage('Category is required.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const {
        code, name, category,
        quantity, unit, period,
        price, currency = 'RWF', priceUnit = 'Kg',
        status = 'available', imageUrl,
        description, location,
      } = req.body;

      // Auto-generate code if not provided
      const autoCode = code?.trim() || `16F${Date.now()}.${new Date().getFullYear()}`;

      const result = await pool.query(
        `INSERT INTO products
          (code, name, category, quantity, unit, period, price, currency, price_unit, status, image_url, description, location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [autoCode, name.trim(), category, quantity || null, unit || null, period || null,
         price || null, currency, priceUnit, status, imageUrl || null,
         description?.trim() || null, location?.trim() || null]
      );

      res.status(201).json({ product: formatProduct(result.rows[0]) });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Product code already exists.' });
      }
      next(err);
    }
  }
);

// ─── PATCH /api/products/:id ──────────────────────────────────────────────────
// Protected (JWT required)
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Product not found.' });

    const current = existing.rows[0];
    const {
      name, category, quantity, unit, period,
      price, currency, priceUnit, status, imageUrl,
      description, location,
    } = req.body;

    const result = await pool.query(
      `UPDATE products SET
        name        = $1,
        category    = $2,
        quantity    = $3,
        unit        = $4,
        period      = $5,
        price       = $6,
        currency    = $7,
        price_unit  = $8,
        status      = $9,
        image_url   = $10,
        description = $11,
        location    = $12,
        updated_at  = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        name       ?? current.name,
        category   ?? current.category,
        quantity   !== undefined ? (quantity || null) : current.quantity,
        unit       !== undefined ? (unit || null)     : current.unit,
        period     !== undefined ? (period || null)   : current.period,
        price      !== undefined ? (price || null)    : current.price,
        currency   ?? current.currency,
        priceUnit  ?? current.price_unit,
        status     ?? current.status,
        imageUrl   !== undefined ? (imageUrl || null) : current.image_url,
        description !== undefined ? (description?.trim() || null) : current.description,
        location   !== undefined ? (location?.trim() || null)     : current.location,
        req.params.id,
      ]
    );

    // If a new image was supplied and it differs from the old one, delete the old one
    if (
      imageUrl !== undefined &&
      imageUrl !== current.image_url &&
      current.image_url
    ) {
      storage.deleteImage(current.image_url);
    }

    res.json({ product: formatProduct(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/products/:id ─────────────────────────────────────────────────
// Protected (JWT required)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id, image_url',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found.' });

    // Clean up the stored image from whichever provider is active
    const imageUrl = result.rows[0].image_url;
    if (imageUrl) storage.deleteImage(imageUrl);

    res.json({ message: 'Product deleted.', id: String(result.rows[0].id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
