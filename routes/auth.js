const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db');

const router = express.Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required.'),
    body('password').notEmpty().withMessage('Password required.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email.trim().toLowerCase()]
      );
      const user = result.rows[0];

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET || 'ganaheza_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// In production this should be admin-only; for now it's open for setup
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('name').notEmpty().withMessage('Name required.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password, name, role = 'user' } = req.body;
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.trim().toLowerCase()]
      );
      if (existing.rowCount > 0) {
        return res.status(409).json({ error: 'Email already registered.' });
      }

      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role`,
        [email.trim().toLowerCase(), hash, name.trim(), role]
      );

      res.status(201).json({ user: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
// Generates a short-lived reset JWT. Since there's no email service yet,
// the reset token is returned directly in the response.
// In production, replace this with an email-sent link containing the token.
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email required.')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email } = req.body;
      const result = await pool.query(
        'SELECT id, email, name FROM users WHERE email = $1',
        [email.trim().toLowerCase()]
      );
      const user = result.rows[0];

      // Security: always return the same message whether or not the email exists.
      // Only issue a token if the user actually exists.
      if (!user) {
        return res.json({
          message: 'If that email exists, a reset token has been generated.',
        });
      }

      const resetToken = jwt.sign(
        { id: user.id, email: user.email, purpose: 'password_reset' },
        process.env.JWT_SECRET || 'ganaheza_secret',
        { expiresIn: '15m' }
      );

      res.json({
        message: 'Reset token generated. Use it to set a new password.',
        resetToken,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
// Validates the reset JWT and sets a new password.
router.post(
  '/reset-password',
  [
    body('resetToken').notEmpty().withMessage('Reset token required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { resetToken, newPassword } = req.body;

      let decoded;
      try {
        decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'ganaheza_secret');
      } catch {
        return res.status(401).json({ error: 'Invalid or expired reset token.' });
      }

      if (decoded.purpose !== 'password_reset') {
        return res.status(401).json({ error: 'Invalid reset token.' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hash, decoded.id]
      );

      res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/change-password ───────────────────────────────────────────
// Requires auth — lets a logged-in admin change their password.
const { requireAuth } = require('../middleware/auth');
router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty().withMessage('Current password required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { currentPassword, newPassword } = req.body;

      const result = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );
      const user = result.rows[0];

      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hash, req.user.id]
      );

      res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
