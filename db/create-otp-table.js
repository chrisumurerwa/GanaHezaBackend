require('dotenv').config();
const pool = require('./index');
async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      otp_hash   TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('OTP table ready.');
  await pool.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
