/**
 * GanaHeza — Quick Setup Script
 * Run: node setup.js
 * 
 * This creates all tables and seeds the admin user in one step.
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function setup() {
  console.log('🔄 Connecting to database...');

  // 1. Create users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          VARCHAR(255) NOT NULL,
      role          VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table ready: users');

  // 2. Create products table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      code        VARCHAR(50) UNIQUE NOT NULL,
      name        VARCHAR(255) NOT NULL,
      category    VARCHAR(100) NOT NULL,
      quantity    NUMERIC,
      unit        VARCHAR(20),
      period      VARCHAR(30),
      price       NUMERIC,
      currency    VARCHAR(10) NOT NULL DEFAULT 'RWF',
      price_unit  VARCHAR(20) NOT NULL DEFAULT 'Kg',
      status      VARCHAR(30) NOT NULL DEFAULT 'available',
      image_url   TEXT,
      description TEXT,
      location    VARCHAR(255),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table ready: products');

  // 3. Create blog_posts table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id           SERIAL PRIMARY KEY,
      category     VARCHAR(100),
      title        VARCHAR(500) NOT NULL,
      summary      TEXT,
      content      TEXT,
      author       VARCHAR(255),
      read_time    VARCHAR(30),
      published_at DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table ready: blog_posts');

  // 4. Create orders table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id               VARCHAR(20) PRIMARY KEY,
      customer_name    VARCHAR(255) NOT NULL,
      customer_phone   VARCHAR(50),
      customer_email   VARCHAR(255),
      product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_snapshot JSONB,
      quantity         NUMERIC NOT NULL DEFAULT 1,
      unit             VARCHAR(20) NOT NULL DEFAULT 'Kg',
      total_price      NUMERIC,
      currency         VARCHAR(10) NOT NULL DEFAULT 'RWF',
      delivery_date    VARCHAR(100),
      order_date       VARCHAR(100),
      notes            TEXT,
      status           VARCHAR(30) NOT NULL DEFAULT 'Pending',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table ready: orders');

  // 5. Create contact_messages table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      phone      VARCHAR(50),
      email      VARCHAR(255) NOT NULL,
      message    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table ready: contact_messages');

  // 6. Seed admin user
  const hash = await bcrypt.hash('ganaheza2026', 10);
  await pool.query(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES ('admin@ganaheza.com', $1, 'GanaHeza Admin', 'admin')
    ON CONFLICT (email) DO NOTHING
  `, [hash]);
  console.log('✅ Admin user ready: admin@ganaheza.com / ganaheza2026');

  // 7. Seed products
  const productCount = await pool.query('SELECT COUNT(*) FROM products');
  if (parseInt(productCount.rows[0].count) === 0) {
    const products = [
      ['16F001.2026','Habanero','Vegetables',200,'Kg','Week',1500,'Fresh Habanero peppers grown in the fertile highlands of Rwanda.','Northern Province, Rwanda'],
      ['16F002.2026','Avocado Hass','Fruits',10,'T','Week',1200,'Premium Hass Avocados with rich, creamy texture.','Western Province, Rwanda'],
      ['16F003.2026','French Beans','Vegetables',8,'T','Week',null,'High-quality French Beans grown for export markets.','Southern Province, Rwanda'],
      ['16F004.2026','Macadamia','Nuts',null,null,null,null,'Premium Macadamia nuts sourced from Rwandan farms.','Rwanda'],
      ['16F005.2026','Inyanya','Vegetables',null,null,null,null,'Fresh tomatoes grown locally in Rwanda.','Rwanda'],
      ['16F006.2026','Maize','Cereals',null,null,null,null,'Quality maize grain sourced from Rwandan farmers.','Rwanda'],
      ['16F007.2026','Passion Fruit','Fruits',6,'T','Week',null,'Fresh passion fruit with vibrant aroma and flavor.','Eastern Province, Rwanda'],
      ['16F008.2026','Coffee','Cash Crops',50,'T','Week',null,'Premium Rwandan coffee beans, world-renowned for their bright acidity.','Rwanda'],
      ['16F009.2026','Avocado Hass','Fruits',50,'T','Week',null,'Large batch Hass Avocados available for export orders.','Rwanda'],
      ['16F010.2026','French Beans','Vegetables',5,'T','Week',null,'Export-grade French Beans.','Rwanda'],
      ['16F011.2026','Teja','Chillies',100,'Kg','Week',null,'Teja chilli peppers with excellent color and pungency.','Rwanda'],
      ['16F012.2026','Habanero','Vegetables',500,'Kg','Week',null,'Large quantity of fresh Habanero peppers available weekly.','Rwanda'],
      ['16F013.2026','Mangoes','Fruits',30,'T','Week',null,'Sweet and juicy Rwandan mangoes in season.','Eastern Province, Rwanda'],
      ['16F014.2026','French Beans','Vegetables',5,'T','Week',null,'Fresh French Beans for weekly supply.','Rwanda'],
      ['16F015.2026','Avocado','Fruits',20,'T','Week',null,'Fresh Avocados sourced from Rwandan farmers.','Rwanda'],
    ];
    for (const p of products) {
      await pool.query(
        `INSERT INTO products (code,name,category,quantity,unit,period,price,description,location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        p
      );
    }
    console.log(`✅ Seeded: ${products.length} products`);
  } else {
    console.log('ℹ️  Products already exist — skipped');
  }

  // 8. Seed blog posts
  const blogCount = await pool.query('SELECT COUNT(*) FROM blog_posts');
  if (parseInt(blogCount.rows[0].count) === 0) {
    const posts = [
      ['Farming Tips','Best Practices for Growing Habanero Peppers in Rwanda','Learn effective techniques for cultivating Habanero peppers in Rwandan highlands.','Habanero peppers thrive in Rwanda\'s highland climate with the right conditions.','GanaHeza Agricultural Team','5 min read','2026-07-15'],
      ['Market Updates','Avocado Export Opportunities Growing for Rwandan Farmers','International demand for Rwandan Hass Avocados continues to rise.','Rwanda\'s avocado sector is experiencing significant growth.','Market Intelligence Team','4 min read','2026-07-10'],
      ['Crop Management','Managing French Bean Production for Export Markets','French beans remain one of Rwanda\'s top export vegetables.','French beans are among Rwanda\'s most valuable export vegetables.','GanaHeza Agricultural Team','6 min read','2026-07-05'],
      ['Pest Control','Integrated Pest Management for Smallholder Farmers','Protecting your crops without over-relying on chemicals.','Integrated Pest Management (IPM) is a sustainable approach.','Agricultural Extension Team','7 min read','2026-06-28'],
      ['Harvesting Tips','Post-Harvest Handling: Reducing Losses and Increasing Value','Post-harvest losses cost Rwandan farmers millions every year.','Post-harvest losses are one of the biggest challenges facing Rwandan farmers.','Post-Harvest Specialist','5 min read','2026-06-20'],
      ['Agricultural News','Rwanda Agricultural Exports Reach Record Levels in 2026','Rwanda\'s agricultural export sector is booming.','Rwanda\'s agricultural exports have reached record levels in 2026.','GanaHeza News Desk','4 min read','2026-06-15'],
    ];
    for (const p of posts) {
      await pool.query(
        `INSERT INTO blog_posts (category,title,summary,content,author,read_time,published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        p
      );
    }
    console.log(`✅ Seeded: ${posts.length} blog posts`);
  } else {
    console.log('ℹ️  Blog posts already exist — skipped');
  }

  await pool.end();
  console.log('\n🎉 Setup complete! You can now login with:');
  console.log('   Email:    admin@ganaheza.com');
  console.log('   Password: ganaheza2026\n');
}

setup().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
