const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db, jwtSecret } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_NAME = "amount_saved_token";
const TOKEN_TTL = "30d";

const DEFAULT_PRESETS = [
  { id: "breakfast", label: "Breakfast", cost: 8 },
  { id: "lunch", label: "Lunch", cost: 12 },
  { id: "dinner", label: "Dinner", cost: 18 },
  { id: "coffee", label: "Coffee", cost: 5 }
];

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: user.id, username: user.username }, jwtSecret, { expiresIn: TOKEN_TTL });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.userId = payload.sub;
    req.username = payload.username;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

function isValidUsername(username) {
  return typeof username === "string" && /^[a-zA-Z0-9_.-]{2,32}$/.test(username);
}

app.post("/api/signup", (req, res) => {
  const { username, password } = req.body || {};
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: "Username must be 2-32 characters (letters, numbers, . _ -)." });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run(username, passwordHash, Date.now());

  const user = { id: result.lastInsertRowid, username };
  setAuthCookie(res, user);
  res.json({ username: user.username });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  setAuthCookie(res, user);
  res.json({ username: user.username });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ username: req.username });
});

app.get("/api/entries", requireAuth, (req, res) => {
  const rows = db
    .prepare("SELECT id, event, amount, ts FROM entries WHERE user_id = ? ORDER BY ts DESC")
    .all(req.userId);
  res.json(rows);
});

app.post("/api/entries", requireAuth, (req, res) => {
  const { event, amount } = req.body || {};
  const trimmedEvent = typeof event === "string" ? event.trim() : "";
  const numericAmount = Number(amount);
  if (!trimmedEvent || !Number.isFinite(numericAmount) || numericAmount < 0) {
    return res.status(400).json({ error: "Provide an event name and a non-negative amount." });
  }

  const ts = Date.now();
  const result = db
    .prepare("INSERT INTO entries (user_id, event, amount, ts) VALUES (?, ?, ?, ?)")
    .run(req.userId, trimmedEvent, numericAmount, ts);

  res.status(201).json({ id: result.lastInsertRowid, event: trimmedEvent, amount: numericAmount, ts });
});

app.delete("/api/entries/:id", requireAuth, (req, res) => {
  const result = db
    .prepare("DELETE FROM entries WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: "Entry not found." });
  res.json({ ok: true });
});

app.get("/api/presets", requireAuth, (req, res) => {
  const overrides = db
    .prepare("SELECT preset_id, cost FROM preset_costs WHERE user_id = ?")
    .all(req.userId);
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.preset_id, o.cost]));

  const presets = DEFAULT_PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    cost: overrideMap.hasOwnProperty(p.id) ? overrideMap[p.id] : p.cost
  }));
  res.json(presets);
});

app.put("/api/presets/:presetId", requireAuth, (req, res) => {
  const presetId = req.params.presetId;
  const known = DEFAULT_PRESETS.some((p) => p.id === presetId);
  if (!known) return res.status(404).json({ error: "Unknown preset." });

  const cost = Number(req.body && req.body.cost);
  if (!Number.isFinite(cost) || cost < 0) {
    return res.status(400).json({ error: "Cost must be a non-negative number." });
  }

  db.prepare(
    `INSERT INTO preset_costs (user_id, preset_id, cost) VALUES (?, ?, ?)
     ON CONFLICT(user_id, preset_id) DO UPDATE SET cost = excluded.cost`
  ).run(req.userId, presetId, cost);

  res.json({ id: presetId, cost });
});

app.listen(PORT, () => {
  console.log(`Amount Saved running at http://localhost:${PORT}`);
});
