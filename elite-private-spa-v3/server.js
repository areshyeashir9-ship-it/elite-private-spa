require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(process.env.DB_PATH || path.join(__dirname, "spa.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  package_name TEXT NOT NULL,
  service_date TEXT NOT NULL,
  location TEXT NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  payment_number TEXT DEFAULT '',
  account_name TEXT DEFAULT '',
  payment_instructions TEXT DEFAULT '',
  private_token TEXT UNIQUE,
  payment_status TEXT NOT NULL DEFAULT 'Unpaid',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "replace-this-development-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }
}));
app.use(express.static(path.join(__dirname, "public")));

const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";
const requireAdmin = (req, res, next) => req.session && req.session.admin ? next() : res.status(401).json({ error: "Please log in" });

app.post("/api/bookings", (req, res) => {
  const { customer_name, email, phone, package_name, service_date, location, notes } = req.body;
  if (![customer_name, email, phone, package_name, service_date, location].every(v => typeof v === "string" && v.trim())) {
    return res.status(400).json({ error: "Please complete all required fields." });
  }
  const result = db.prepare(`INSERT INTO bookings
    (customer_name,email,phone,package_name,service_date,location,notes)
    VALUES (?,?,?,?,?,?,?)`).run(customer_name.trim(), email.trim(), phone.trim(), package_name.trim(), service_date.trim(), location.trim(), (notes || "").trim());
  res.json({ ok: true, bookingId: result.lastInsertRowid, message: "Booking request received. The spa will contact you." });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS && ADMIN_PASS !== "CHANGE_THIS_PASSWORD") {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Invalid login. Check your .env settings." });
});
app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/me", (req, res) => res.json({ loggedIn: !!(req.session && req.session.admin) }));

app.get("/api/admin/bookings", requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM bookings ORDER BY id DESC").all());
});
app.patch("/api/admin/bookings/:id", requireAdmin, (req, res) => {
  const { status, payment_status, payment_number, account_name, payment_instructions, generate_link } = req.body;
  const booking = db.prepare("SELECT * FROM bookings WHERE id=?").get(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  const allowedStatus = ["Pending", "Confirmed", "Rejected"];
  const allowedPayment = ["Unpaid", "Paid"];
  const nextStatus = allowedStatus.includes(status) ? status : booking.status;
  const nextPayment = allowedPayment.includes(payment_status) ? payment_status : booking.payment_status;
  let token = booking.private_token;
  if (generate_link || (payment_number && payment_number.trim())) {
    if (!token) token = crypto.randomBytes(24).toString("hex");
  }
  db.prepare(`UPDATE bookings SET status=?, payment_status=?, payment_number=?, account_name=?,
    payment_instructions=?, private_token=? WHERE id=?`).run(
      nextStatus, nextPayment,
      typeof payment_number === "string" ? payment_number.trim() : booking.payment_number,
      typeof account_name === "string" ? account_name.trim() : booking.account_name,
      typeof payment_instructions === "string" ? payment_instructions.trim() : booking.payment_instructions,
      token, req.params.id
    );
  const updated = db.prepare("SELECT * FROM bookings WHERE id=?").get(req.params.id);
  const base = (process.env.BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  res.json({ booking: updated, privateLink: token ? `${base}/payment.html?token=${token}` : null });
});
app.get("/api/payment/:token", (req, res) => {
  const b = db.prepare(`SELECT customer_name, package_name, service_date, status, payment_number,
    account_name, payment_instructions, payment_status FROM bookings WHERE private_token=?`).get(req.params.token);
  if (!b) return res.status(404).json({ error: "This private payment link is invalid." });
  if (!b.payment_number) return res.status(404).json({ error: "Payment details are not ready yet. Please contact the spa." });
  res.json(b);
});

app.listen(PORT, () => console.log(`Elite Private Spa running on port ${PORT}`));
