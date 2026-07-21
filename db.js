const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "app.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    amount REAL NOT NULL,
    ts INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS preset_costs (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preset_id TEXT NOT NULL,
    cost REAL NOT NULL,
    PRIMARY KEY (user_id, preset_id)
  );

  CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
`);

const secretPath = path.join(dataDir, "secret.txt");
if (!fs.existsSync(secretPath)) {
  fs.writeFileSync(secretPath, crypto.randomBytes(32).toString("hex"));
}
const jwtSecret = fs.readFileSync(secretPath, "utf8").trim();

module.exports = { db, jwtSecret };
