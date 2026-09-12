require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// ─── Connect as superuser to create the DB ────────────────────────────────────
async function ensureDatabase() {
  const dbUrl = process.env.DATABASE_URL;

  // For cloud PostgreSQL (Neon, Supabase, Railway): the DB is already created.
  // We connect directly to it with SSL to verify the connection.
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database.');
    await client.end();
  } catch (err) {
    throw new Error(`Cannot connect to database: ${err.message}`);
  }
}



// ─── Main migration ───────────────────────────────────────────────────────────
async function migrate() {
  await ensureDatabase();

  const pool = require('./index');

  // ── Create Tables ──────────────────────────────────────────────────────────
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
  console.log('✅ Table: users');

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
  console.log('✅ Table: products');

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
  console.log('✅ Table: blog_posts');

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
  console.log('✅ Table: orders');

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
  console.log('✅ Table: contact_messages');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      otp_hash   TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table: password_reset_otps');

  // ── Seed Users ─────────────────────────────────────────────────────────────
  const adminEmail = 'cumurerwa405@gmail.com';
  const existingAdmin = await pool.query(
    'SELECT id FROM users WHERE email = $1', [adminEmail]
  );
  if (existingAdmin.rowCount === 0) {
    const hash = await bcrypt.hash('ganaheza2026', 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)`,
      [adminEmail, hash, 'GanaHeza Admin', 'admin']
    );
    console.log('✅ Seeded: admin user (cumurerwa405@gmail.com / ganaheza2026)');
  } else {
    console.log('ℹ️  Admin user already seeded.');
  }

  // ── Seed Products ──────────────────────────────────────────────────────────
  const productCount = await pool.query('SELECT COUNT(*) FROM products');
  if (parseInt(productCount.rows[0].count, 10) === 0) {
    // Image URLs hosted on Cloudinary CDN (works in production on any host)
    const IMG = {
      habanero:    'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/a2gejonsyxw41lylaikm.jpg',
      avocado:     'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/lysey9awcdxqgdk4s9z3.jpg',
      beans:       'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/yjdqzgjvwfaezhhshjhc.jpg',
      macadamia:   'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/qpleoy3rrb3jvknclsat.jpg',
      tomatoes:    'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/hxan5unsxf68n7dtlsj0.jpg',
      maize:       'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/yvdeazl4koqauzwikmpg.jpg',
      passionFruit:'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/kvxdggcgsp1lpcwdkmcn.jpg',
      coffee:      'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/q5sdcmmllbjg90fmmkxo.jpg',
      teja:        'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/p6yjcen1dxbfdyshiln5.jpg',
      mangoes:     'https://res.cloudinary.com/b2s1xmw7/image/upload/ganaheza/products/en3abnavp49vmgp4cnqb.jpg',
    };

    const products = [
      { code: '16F001.2026', name: 'Habanero',      category: 'Chillies',   quantity: 200,  unit: 'Kg', period: 'Week', price: 1500, image_url: IMG.habanero,    description: 'Fresh Habanero peppers grown in the fertile highlands of Rwanda.',        location: 'Northern Province, Rwanda' },
      { code: '16F002.2026', name: 'Avocado Hass',  category: 'Fruits',     quantity: 10,   unit: 'T',  period: 'Week', price: 1200, image_url: IMG.avocado,     description: 'Premium Hass Avocados with rich, creamy texture.',                        location: 'Western Province, Rwanda' },
      { code: '16F003.2026', name: 'French Beans',  category: 'Vegetables', quantity: 8,    unit: 'T',  period: 'Week', price: null, image_url: IMG.beans,       description: 'High-quality French Beans grown for export markets.',                    location: 'Southern Province, Rwanda' },
      { code: '16F004.2026', name: 'Macadamia',     category: 'Nuts',       quantity: null, unit: null, period: null,   price: null, image_url: IMG.macadamia,   description: 'Premium Macadamia nuts sourced from Rwandan farms.',                      location: 'Rwanda' },
      { code: '16F005.2026', name: 'Inyanya',       category: 'Vegetables', quantity: null, unit: null, period: null,   price: null, image_url: IMG.tomatoes,    description: 'Fresh tomatoes grown locally in Rwanda.',                                  location: 'Rwanda' },
      { code: '16F006.2026', name: 'Maize',         category: 'Cereals',    quantity: null, unit: null, period: null,   price: null, image_url: IMG.maize,       description: 'Quality maize grain sourced from Rwandan farmers.',                       location: 'Rwanda' },
      { code: '16F007.2026', name: 'Passion Fruit', category: 'Fruits',     quantity: 6,    unit: 'T',  period: 'Week', price: null, image_url: IMG.passionFruit,description: 'Fresh passion fruit with vibrant aroma and flavor.',                     location: 'Eastern Province, Rwanda' },
      { code: '16F008.2026', name: 'Coffee',        category: 'Cash Crops', quantity: 50,   unit: 'T',  period: 'Week', price: null, image_url: IMG.coffee,      description: 'Premium Rwandan coffee beans, world-renowned for their bright acidity.', location: 'Rwanda' },
      { code: '16F009.2026', name: 'Avocado Hass',  category: 'Fruits',     quantity: 50,   unit: 'T',  period: 'Week', price: null, image_url: IMG.avocado,     description: 'Large batch Hass Avocados available for export orders.',                 location: 'Rwanda' },
      { code: '16F010.2026', name: 'French Beans',  category: 'Vegetables', quantity: 5,    unit: 'T',  period: 'Week', price: null, image_url: IMG.beans,       description: 'Export-grade French Beans.',                                             location: 'Rwanda' },
      { code: '16F011.2026', name: 'Teja',          category: 'Chillies',   quantity: 100,  unit: 'Kg', period: 'Week', price: null, image_url: IMG.teja,        description: 'Teja chilli peppers with excellent color and pungency.',                 location: 'Rwanda' },
      { code: '16F012.2026', name: 'Habanero',      category: 'Chillies',   quantity: 500,  unit: 'Kg', period: 'Week', price: null, image_url: IMG.habanero,    description: 'Large quantity of fresh Habanero peppers available weekly.',             location: 'Rwanda' },
      { code: '16F013.2026', name: 'Mangoes',       category: 'Fruits',     quantity: 30,   unit: 'T',  period: 'Week', price: null, image_url: IMG.mangoes,     description: 'Sweet and juicy Rwandan mangoes in season.',                            location: 'Eastern Province, Rwanda' },
      { code: '16F014.2026', name: 'French Beans',  category: 'Vegetables', quantity: 5,    unit: 'T',  period: 'Week', price: null, image_url: IMG.beans,       description: 'Fresh French Beans for weekly supply.',                                  location: 'Rwanda' },
      { code: '16F015.2026', name: 'Avocado',       category: 'Fruits',     quantity: 20,   unit: 'T',  period: 'Week', price: null, image_url: IMG.avocado,     description: 'Fresh Avocados sourced from Rwandan farmers.',                          location: 'Rwanda' },
    ];

    for (const p of products) {
      await pool.query(
        `INSERT INTO products (code, name, category, quantity, unit, period, price, currency, price_unit, status, image_url, description, location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'RWF','Kg','available',$8,$9,$10)`,
        [p.code, p.name, p.category, p.quantity, p.unit, p.period, p.price, p.image_url, p.description, p.location]
      );
    }
    console.log(`✅ Seeded: ${products.length} products`);
  } else {
    console.log('ℹ️  Products already seeded.');
  }

  // ── Seed Blog Posts ────────────────────────────────────────────────────────
  const blogCount = await pool.query('SELECT COUNT(*) FROM blog_posts');
  if (parseInt(blogCount.rows[0].count, 10) === 0) {
    const posts = [
      {
        category: 'Farming Tips',
        title: 'Best Practices for Growing Habanero Peppers in Rwanda',
        summary: 'Learn effective techniques for cultivating Habanero peppers in Rwandan highlands, from soil preparation to pest management.',
        content: `Habanero peppers thrive in Rwanda's highland climate with the right conditions.\n\n**Soil Preparation**\nHabaneros prefer well-drained, loamy soil with a pH between 6.0 and 7.0. Prepare your land by tilling to a depth of 30 cm and incorporating organic compost.\n\n**Planting Season**\nThe best time to plant is at the onset of the rainy season. Seedlings should be started indoors 8-10 weeks before transplanting.\n\n**Watering**\nConsistent moisture is crucial, especially during flowering and fruit development.\n\n**Harvesting**\nHabaneros are ready for harvest 90-100 days after transplanting. Pick fruits when they are fully colored for maximum heat and flavor.`,
        author: 'GanaHeza Agricultural Team',
        read_time: '5 min read',
        published_at: '2026-07-15',
      },
      {
        category: 'Market Updates',
        title: 'Avocado Export Opportunities Growing for Rwandan Farmers',
        summary: 'International demand for Rwandan Hass Avocados continues to rise. Find out how farmers can benefit from these new export opportunities.',
        content: `Rwanda's avocado sector is experiencing significant growth as international buyers increasingly seek out the country's premium Hass variety.\n\n**Rising Global Demand**\nEurope and the Middle East have shown consistent demand growth for African avocados.\n\n**Quality Standards**\nTo access premium export markets, farmers must meet strict quality standards including minimum fruit size, proper ripening stage, and correct post-harvest handling.\n\n**Price Premium**\nExport-grade avocados typically command 30-50% higher prices than local market rates.`,
        author: 'Market Intelligence Team',
        read_time: '4 min read',
        published_at: '2026-07-10',
      },
      {
        category: 'Crop Management',
        title: 'Managing French Bean Production for Export Markets',
        summary: "French beans remain one of Rwanda's top export vegetables. Discover how to manage your crop for consistent, export-quality yields.",
        content: `French beans are among Rwanda's most valuable export vegetables, with consistent demand from European supermarkets.\n\n**Variety Selection**\nChoose certified, export-preferred varieties recommended by your cooperative or agricultural extension officer.\n\n**Irrigation Management**\nDrip irrigation is the most efficient method for French beans. Maintain consistent moisture but avoid overwatering.\n\n**Harvest and Post-Harvest**\nHarvest every 2-3 days to maintain pod quality. Use clean, ventilated containers and move to cool storage quickly.`,
        author: 'GanaHeza Agricultural Team',
        read_time: '6 min read',
        published_at: '2026-07-05',
      },
      {
        category: 'Pest Control',
        title: 'Integrated Pest Management for Smallholder Farmers',
        summary: "Protecting your crops without over-relying on chemicals. A practical guide to IPM for Rwanda's smallholder farmers.",
        content: `Integrated Pest Management (IPM) is a sustainable approach to managing crop pests that minimizes the use of synthetic pesticides.\n\n**What is IPM?**\nIPM combines biological control, cultural control, physical control, and chemical control used as a last resort.\n\n**Monitor Your Crops**\nWalk your fields regularly at least twice a week to identify pest problems early.\n\n**Benefits of IPM**\nLower input costs, safer produce for export markets, healthier farm environment, and reduced chemical residues.`,
        author: 'Agricultural Extension Team',
        read_time: '7 min read',
        published_at: '2026-06-28',
      },
      {
        category: 'Harvesting Tips',
        title: 'Post-Harvest Handling: Reducing Losses and Increasing Value',
        summary: 'Post-harvest losses cost Rwandan farmers millions every year. Learn practical techniques to preserve product quality from farm to market.',
        content: `Post-harvest losses are one of the biggest challenges facing Rwandan farmers, with estimates suggesting 25-40% of produce is lost before reaching consumers.\n\n**Harvesting at the Right Time**\nThe right maturity stage depends on the crop and the intended market. For export, harvest slightly early to allow for transit time.\n\n**Handling with Care**\nUse clean, smooth-surfaced containers. Avoid dropping or compressing produce.\n\n**Temperature Management**\nHeat is the enemy of fresh produce. Move produce to shade immediately after harvest.`,
        author: 'Post-Harvest Specialist',
        read_time: '5 min read',
        published_at: '2026-06-20',
      },
      {
        category: 'Agricultural News',
        title: 'Rwanda Agricultural Exports Reach Record Levels in 2026',
        summary: "Rwanda's agricultural export sector is booming. Discover what this means for farmers and how to position yourself for maximum benefit.",
        content: `Rwanda's agricultural exports have reached record levels in 2026, driven by strong international demand.\n\n**Key Growth Sectors**\nThe fastest growing export categories include Hass Avocados, Chilli Peppers, French Beans, Coffee, and Macadamia Nuts.\n\n**Opportunities for Farmers**\nThis growth creates real opportunities for smallholder farmers who can meet consistent quality and volume requirements.\n\n**GanaHeza's Role**\nGanaHeza is committed to connecting Rwanda's farmers with the buyers and information they need to participate fully in this growing market.`,
        author: 'GanaHeza News Desk',
        read_time: '4 min read',
        published_at: '2026-06-15',
      },
    ];

    for (const post of posts) {
      await pool.query(
        `INSERT INTO blog_posts (category, title, summary, content, author, read_time, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [post.category, post.title, post.summary, post.content, post.author, post.read_time, post.published_at]
      );
    }
    console.log(`✅ Seeded: ${posts.length} blog posts`);
  } else {
    console.log('ℹ️  Blog posts already seeded.');
  }

  // ── Seed Sample Orders ─────────────────────────────────────────────────────
  const orderCount = await pool.query('SELECT COUNT(*) FROM orders');
  if (parseInt(orderCount.rows[0].count, 10) === 0) {
    // Get product IDs
    const p2 = await pool.query(`SELECT id FROM products WHERE code = '16F002.2026'`);
    const p1 = await pool.query(`SELECT id FROM products WHERE code = '16F001.2026'`);
    const p5 = await pool.query(`SELECT id FROM products WHERE code = '16F005.2026'`);

    const sampleOrders = [
      {
        id: 'ORD-7821',
        customer_name: 'Jean Paul Mugisha',
        customer_phone: '+250 788 123 456',
        customer_email: 'mugisha.jp@gmail.com',
        product_id: p2.rows[0]?.id || null,
        product_snapshot: JSON.stringify({ name: 'Avocado Hass', category: 'Fruits', code: '16F002.2026', price: 1200, currency: 'RWF', priceUnit: 'Kg', location: 'Western Province, Rwanda' }),
        quantity: 5,
        unit: 'Tonnes',
        total_price: 6000000,
        currency: 'RWF',
        delivery_date: '28 Aug 2026',
        order_date: '25 Aug 2026, 09:15 AM',
        notes: 'Require export-grade packing for air freight delivery to Kigali Airport.',
        status: 'Pending',
      },
      {
        id: 'ORD-7820',
        customer_name: 'Marie Claire Uwase',
        customer_phone: '+250 783 987 654',
        customer_email: 'uwase.marie@agrodealers.rw',
        product_id: p1.rows[0]?.id || null,
        product_snapshot: JSON.stringify({ name: 'Habanero', category: 'Vegetables', code: '16F001.2026', price: 1500, currency: 'RWF', priceUnit: 'Kg', location: 'Northern Province, Rwanda' }),
        quantity: 250,
        unit: 'Kg',
        total_price: 375000,
        currency: 'RWF',
        delivery_date: '30 Aug 2026',
        order_date: '24 Aug 2026, 02:40 PM',
        notes: 'Please ensure fresh harvest within 24 hours before pickup in Musanze.',
        status: 'Confirmed',
      },
      {
        id: 'ORD-7819',
        customer_name: 'Emmanuel Hakizimana',
        customer_phone: '+250 785 456 789',
        customer_email: 'e.hakizimana@hoteldesmilles.rw',
        product_id: p5.rows[0]?.id || null,
        product_snapshot: JSON.stringify({ name: 'Inyanya', category: 'Vegetables', code: '16F005.2026', price: 800, currency: 'RWF', priceUnit: 'Kg', location: 'Eastern Province, Rwanda' }),
        quantity: 100,
        unit: 'Kg',
        total_price: 80000,
        currency: 'RWF',
        delivery_date: '26 Aug 2026',
        order_date: '23 Aug 2026, 11:05 AM',
        notes: 'Weekly fresh delivery for restaurant supply.',
        status: 'Delivered',
      },
    ];

    for (const o of sampleOrders) {
      await pool.query(
        `INSERT INTO orders (id, customer_name, customer_phone, customer_email, product_id, product_snapshot, quantity, unit, total_price, currency, delivery_date, order_date, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [o.id, o.customer_name, o.customer_phone, o.customer_email, o.product_id, o.product_snapshot,
         o.quantity, o.unit, o.total_price, o.currency, o.delivery_date, o.order_date, o.notes, o.status]
      );
    }
    console.log(`✅ Seeded: ${sampleOrders.length} sample orders`);
  } else {
    console.log('ℹ️  Orders already seeded.');
  }

  await pool.end();
  console.log('\n🎉 Migration complete! GanaHeza database is ready.\n');
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
