require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// No fallback secrets — if not set, generate strong random values on each start
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
if (!process.env.JWT_SECRET) {
  console.log('WARNING: JWT_SECRET not set. Using auto-generated secret (valid for this session only).');
  console.log('Generated JWT_SECRET=' + JWT_SECRET);
}

let ADMIN_PASS = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASS) {
  ADMIN_PASS = crypto.randomBytes(16).toString('hex');
  console.log('WARNING: ADMIN_PASSWORD not set. Auto-generated admin password: ' + ADMIN_PASS);
  console.log('Set ADMIN_PASSWORD in your environment variables to use a fixed password.');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting — admin login: 5 attempts per 15 min per IP
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Choose data backend: Google Sheets (production) or SQLite (local dev)
let db;
if (process.env.GOOGLE_SHEET_ID) {
  db = require('./sheets');
} else {
  db = require('./database-local');
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// === AUTH ===
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    const existing = await db.getUserByEmail(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const hash = bcrypt.hashSync(password, 10);
    const user = await db.addUser(name, email, hash);
    const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await db.getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/me', auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    await db.updateUser(req.user.id, { name, phone });
    const user = await db.getUserById(req.user.id);
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// === CLASSES ===
app.get('/api/classes', async (req, res) => {
  try {
    const classes = await db.getClasses();
    res.json(classes);
  } catch (e) {
    console.error('Classes error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// === BOOKINGS ===
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const bookings = await db.getBookingsByUserId(req.user.id);
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { class_id, booking_date } = req.body;
    if (!class_id || !booking_date) return res.status(400).json({ error: 'Missing fields' });
    const classes = await db.getClasses();
    const cls = classes.find(c => c.id === class_id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const count = await db.getBookingCount(class_id, booking_date);
    if (count >= cls.capacity) return res.status(400).json({ error: 'Class is full' });
    const existing = await db.hasExistingBooking(req.user.id, class_id, booking_date);
    if (existing) return res.status(400).json({ error: 'Already booked this class' });
    const id = await db.addBooking(req.user.id, class_id, booking_date);
    res.json({ id, message: 'Class booked successfully' });
  } catch (e) {
    console.error('Booking error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/bookings/:id', auth, async (req, res) => {
  try {
    const ok = await db.deleteBooking(parseInt(req.params.id, 10), req.user.id);
    if (!ok) return res.status(404).json({ error: 'Booking not found' });
    res.json({ message: 'Booking cancelled' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// === CONTACT ===
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'All fields required' });
    await db.addContactMessage(name, email, message);
    res.json({ message: 'Message sent. We will get back to you!' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// === ADMIN ===
app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  if (password !== ADMIN_PASS) return res.status(401).json({ error: 'Invalid password' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/bookings', adminAuth, async (req, res) => {
  try {
    const bookings = await db.getAllBookings();
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/contacts', adminAuth, async (req, res) => {
  try {
    const contacts = await db.getAllContacts();
    res.json(contacts);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/content', adminAuth, async (req, res) => {
  try {
    const content = await db.getContent();
    res.json(content);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/content', adminAuth, async (req, res) => {
  try {
    const { key, value } = req.body;
    await db.setContent(key, value);
    res.json({ message: 'Content updated' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/classes', adminAuth, async (req, res) => {
  try {
    const id = await db.addClass(req.body);
    res.json({ id, message: 'Class added' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/classes/:id', adminAuth, async (req, res) => {
  try {
    const ok = await db.updateClass(parseInt(req.params.id, 10), req.body);
    if (!ok) return res.status(404).json({ error: 'Class not found' });
    res.json({ message: 'Class updated' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/classes/:id', adminAuth, async (req, res) => {
  try {
    const ok = await db.deleteClass(parseInt(req.params.id, 10));
    if (!ok) return res.status(404).json({ error: 'Class not found' });
    res.json({ message: 'Class deactivated' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// SPA fallback — redirect /admin to admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  try {
    await db.init();
    console.log('Database ready (' + (process.env.GOOGLE_SHEET_ID ? 'Google Sheets' : 'SQLite local') + ')');
  } catch (e) {
    console.error('Database init error:', e.message);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log('Gym website running at http://localhost:' + PORT);
  });
}

start();
