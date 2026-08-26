const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');

const router = express.Router();

// ─── POST /api/contact ────────────────────────────────────────────────────────
// Public — saves the contact form submission to the DB.
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('Valid email is required.'),
    body('message').notEmpty().withMessage('Message is required.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, phone, email, message } = req.body;
      await pool.query(
        `INSERT INTO contact_messages (name, phone, email, message)
         VALUES ($1,$2,$3,$4)`,
        [name.trim(), phone?.trim() || null, email.trim().toLowerCase(), message.trim()]
      );
      res.status(201).json({ success: true, message: 'Message received. We will get back to you soon.' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/contact ─────────────────────────────────────────────────────────
// Protected (admin only) — view all submitted contact messages
const { requireAuth } = require('../middleware/auth');
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json({ messages: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
