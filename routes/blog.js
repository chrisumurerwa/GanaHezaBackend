const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function formatPost(row) {
  return {
    id:          String(row.id),
    category:    row.category,
    title:       row.title,
    summary:     row.summary,
    content:     row.content,
    author:      row.author,
    readTime:    row.read_time,
    date:        row.published_at,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ─── GET /api/blog ────────────────────────────────────────────────────────────
// Public. Returns all posts newest first.
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM blog_posts ORDER BY published_at DESC, created_at DESC');
    res.json({ posts: result.rows.map(formatPost) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/blog/:id ────────────────────────────────────────────────────────
// Public.
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Blog post not found.' });
    res.json({ post: formatPost(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/blog ───────────────────────────────────────────────────────────
// Protected.
router.post(
  '/',
  requireAuth,
  [
    body('title').notEmpty().withMessage('Title is required.'),
    body('content').notEmpty().withMessage('Content is required.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { category, title, summary, content, author, readTime, publishedAt } = req.body;
      const result = await pool.query(
        `INSERT INTO blog_posts (category, title, summary, content, author, read_time, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          category || null,
          title.trim(),
          summary?.trim() || null,
          content.trim(),
          author?.trim() || 'GanaHeza Team',
          readTime || null,
          publishedAt || new Date().toISOString().split('T')[0],
        ]
      );
      res.status(201).json({ post: formatPost(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/blog/:id ──────────────────────────────────────────────────────
// Protected.
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Blog post not found.' });

    const cur = existing.rows[0];
    const { category, title, summary, content, author, readTime, publishedAt } = req.body;

    const result = await pool.query(
      `UPDATE blog_posts SET
        category     = $1,
        title        = $2,
        summary      = $3,
        content      = $4,
        author       = $5,
        read_time    = $6,
        published_at = $7,
        updated_at   = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        category     ?? cur.category,
        title        ?? cur.title,
        summary      ?? cur.summary,
        content      ?? cur.content,
        author       ?? cur.author,
        readTime     ?? cur.read_time,
        publishedAt  ?? cur.published_at,
        req.params.id,
      ]
    );
    res.json({ post: formatPost(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/blog/:id ─────────────────────────────────────────────────────
// Protected.
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM blog_posts WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Blog post not found.' });
    res.json({ message: 'Blog post deleted.', id: String(result.rows[0].id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
