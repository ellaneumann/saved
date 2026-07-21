const crypto = require("crypto");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Point it at a Postgres connection string.");
}

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      ts BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preset_costs (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      preset_id TEXT NOT NULL,
      cost DOUBLE PRECISION NOT NULL,
      PRIMARY KEY (user_id, preset_id)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
  `);
}

// JWT_SECRET should be set as a real env var in production so sessions
// survive redeploys. This fallback keeps local/dev runs working without one.
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not set — using a random secret for this run only. Every restart will sign everyone out.");
}

module.exports = { pool, init, jwtSecret };
