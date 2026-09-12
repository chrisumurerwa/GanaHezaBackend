const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { sendOtpEmail } = require('../services/email');

const router = express.Router();

// ─── Helper: generate 6-digit OTP ────────────────────────────────────────────
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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
// Sends a 6-digit OTP to the user's email. OTP expires in 10 minutes.
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

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: 'If that email is registered, an OTP has been sent.' });
      }

      // Generate OTP
      const otp = generateOtp();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate any previous unused OTPs for this user
      await pool.query(
        'UPDATE password_reset_otps SET used = TRUE WHERE user_id = $1 AND used = FALSE',
        [user.id]
      );

      // Store new OTP
      await pool.query(
        'INSERT INTO password_reset_otps (user_id, otp_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, otpHash, expiresAt]
      );

      // Send OTP email — wait for it and return error if it fails
      try {
        await sendOtpEmail(user.email, user.name, otp);
      } catch (emailErr) {
        console.error('[forgot-password] Email send failed:', emailErr.message);
        return res.status(500).json({ error: 'Failed to send reset code: ' + emailErr.message });
      }

      res.json({ message: 'A 6-digit reset code has been sent to your email.' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
// Validates OTP and sets a new password.
router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Valid email required.'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, otp, newPassword } = req.body;

      // Get user
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.trim().toLowerCase()]
      );
      const user = userResult.rows[0];
      if (!user) {
        return res.status(400).json({ error: 'Invalid code or email.' });
      }

      // Get latest valid OTP
      const otpResult = await pool.query(
        `SELECT id, otp_hash FROM password_reset_otps
         WHERE user_id = $1 AND used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );
      const otpRecord = otpResult.rows[0];

      if (!otpRecord) {
        return res.status(400).json({ error: 'OTP has expired or already been used. Please request a new one.' });
      }

      // Verify OTP
      const match = await bcrypt.compare(otp, otpRecord.otp_hash);
      if (!match) {
        return res.status(400).json({ error: 'Invalid reset code. Please check and try again.' });
      }

      // Mark OTP as used
      await pool.query(
        'UPDATE password_reset_otps SET used = TRUE WHERE id = $1',
        [otpRecord.id]
      );

      // Update password
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hash, user.id]
      );

      res.json({ message: 'Password reset successfully. You can now log in.' });
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
