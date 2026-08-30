require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes     = require('./routes/auth');
const productRoutes  = require('./routes/products');
const blogRoutes     = require('./routes/blog');
const orderRoutes    = require('./routes/orders');
const contactRoutes  = require('./routes/contact');
const errorHandler   = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',          // Allow all origins for mobile dev (Expo runs on a different host)
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Files (serve product images) ─────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    app:     'GanaHeza API',
    version: '1.0.0',
    status:  'running',
    time:    new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/blog',     blogRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/contact',  contactRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 GanaHeza API running on http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/products`);
  console.log(`   GET    /api/blog`);
  console.log(`   POST   /api/orders`);
  console.log(`   POST   /api/contact`);
  console.log(`   POST   /api/auth/forgot-password`);
  console.log(`   POST   /api/auth/reset-password`);
  console.log(`   POST   /api/auth/change-password\n`);
});

module.exports = app;
