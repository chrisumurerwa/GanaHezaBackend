const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['Pending', 'Confirmed', 'Delivered', 'Cancelled'];

function formatOrder(row) {
  return {
    id:            row.id,
    customerName:  row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    // Return the live product if still exists, else fall back to the snapshot saved at order time
    product:       row.product_snapshot || null,
    quantity:      row.quantity !== null ? Number(row.quantity) : null,
    unit:          row.unit,
    totalPrice:    row.total_price !== null ? Number(row.total_price) : null,
    currency:      row.currency,
    deliveryDate:  row.delivery_date,
    orderDate:     row.order_date,
    notes:         row.notes,
    status:        row.status,
    createdAt:     row.created_at,
  };
}

// ─── GET /api/orders ──────────────────────────────────────────────────────────
// Protected. Supports ?status=Pending|Confirmed|Delivered|Cancelled
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && VALID_STATUSES.includes(status)) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ orders: result.rows.map(formatOrder) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// Public — anyone can place an order (no login needed for customers).
router.post(
  '/',
  [
    body('customerName').notEmpty().withMessage('Customer name is required.'),
    body('quantity').isNumeric().withMessage('Quantity must be a number.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const {
        customerName, customerPhone, customerEmail,
        product,        // full product object from frontend
        quantity, unit = 'Kg',
        totalPrice, currency = 'RWF',
        deliveryDate, orderDate, notes,
      } = req.body;

      // Generate order ID like ORD-XXXX
      const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      }) + `, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

      // Strip React Native image require() from product snapshot before storing
      const productSnapshot = product ? {
        id:          product.id,
        name:        product.name,
        category:    product.category,
        code:        product.code,
        price:       product.price,
        currency:    product.currency,
        priceUnit:   product.priceUnit,
        location:    product.location,
        description: product.description,
        imageUrl:    product.imageUrl || product.image_url || null,
      } : null;

      // Look up real product ID in DB if product.id is provided
      let dbProductId = null;
      if (product?.id) {
        const found = await pool.query('SELECT id FROM products WHERE id = $1', [product.id]);
        if (found.rows[0]) dbProductId = found.rows[0].id;
      }

      const result = await pool.query(
        `INSERT INTO orders
          (id, customer_name, customer_phone, customer_email, product_id, product_snapshot,
           quantity, unit, total_price, currency, delivery_date, order_date, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Pending')
         RETURNING *`,
        [
          orderId,
          customerName.trim(),
          customerPhone?.trim() || null,
          customerEmail?.trim() || null,
          dbProductId,
          productSnapshot ? JSON.stringify(productSnapshot) : null,
          Number(quantity),
          unit,
          totalPrice || null,
          currency,
          deliveryDate || null,
          orderDate || formattedDate,
          notes?.trim() || null,
        ]
      );

      res.status(201).json({ order: formatOrder(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/orders/:id/status ────────────────────────────────────────────
// Protected. Updates order status only.
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Order not found.' });
    res.json({ order: formatOrder(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/orders/:id ───────────────────────────────────────────────────
// Protected.
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Order not found.' });
    res.json({ message: 'Order deleted.', id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
