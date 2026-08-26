/**
 * Seed product images into the database.
 *
 * Maps each product (by code) to its corresponding image file
 * and updates the image_url column.
 *
 * Usage:
 *   node db/seed-images.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./index'); // db connection pool

// ── Product code → image file mapping ─────────────────────────────────────────
const productImages = {
  '16F001.2026': 'habanero.jpg',
  '16F002.2026': 'avocado.jpg',
  '16F003.2026': 'beans.jpg',
  '16F004.2026': 'macadamia.jpg',
  '16F005.2026': 'tomatoes.jpg',   // Inyanya = tomatoes in Kinyarwanda
  '16F006.2026': 'maize.jpg',
  '16F007.2026': 'passion-fruit.jpg',
  '16F008.2026': 'coffee.jpg',
  '16F009.2026': 'avocado.jpg',    // Avocado Hass (second listing)
  '16F010.2026': 'beans.jpg',      // French Beans (second listing)
  '16F011.2026': 'teja.jpg',
  '16F012.2026': 'habanero.jpg',   // Habanero (second listing)
  '16F013.2026': 'mangoes.jpg',
  '16F014.2026': 'beans.jpg',      // French Beans (third listing)
  '16F015.2026': 'avocado.jpg',    // Avocado (third listing)
};

// ── Base URL for served images ────────────────────────────────────────────────
// Images are served via express.static at /uploads/products/
// Use relative path so it works regardless of host (localhost, LAN IP, etc.)
const IMAGE_BASE = '/uploads/products/';

async function seedImages() {
  try {
    console.log('\n🌿 Seeding product images...\n');

    let updated = 0;
    let skipped = 0;

    for (const [code, imageFile] of Object.entries(productImages)) {
      const imageUrl = IMAGE_BASE + imageFile;

      const result = await pool.query(
        'UPDATE products SET image_url = $1, updated_at = NOW() WHERE code = $2 RETURNING id, name, image_url',
        [imageUrl, code]
      );

      if (result.rows.length > 0) {
        console.log(`  ✅ ${code}  ${result.rows[0].name.padEnd(20)} → ${imageFile}`);
        updated++;
      } else {
        console.log(`  ⚠️  ${code}  (not found in database)`);
        skipped++;
      }
    }

    // Also update the original migrate.js seed data so future re-seeds include images
    console.log(`\n─────────────────────────────────────────────`);
    console.log(`✅ Updated: ${updated} products`);
    console.log(`⚠️  Skipped: ${skipped} products (not found)`);
    console.log(`\nImages are served at: http://<your-api-host>:3000${IMAGE_BASE}<filename>`);
    console.log(`Example: http://localhost:3000${IMAGE_BASE}habanero.jpg\n`);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding images:', err.message);
    await pool.end();
    process.exit(1);
  }
}

seedImages();
