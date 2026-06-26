const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'gym.db');
let db = null;

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function query(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params) {
  db.run(sql, params);
  save();
}

// === Classes ===
async function getClasses() {
  return query('SELECT * FROM classes WHERE active = 1 OR active IS NULL ORDER BY day, time');
}

async function addClass(data) {
  run('INSERT INTO classes (name, description, time, day, duration, capacity, instructor, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
    [data.name, data.description || '', data.time, data.day, data.duration || 60, data.capacity || 20, data.instructor || '']);
  const row = get('SELECT id FROM classes ORDER BY id DESC LIMIT 1');
  return row.id;
}

async function updateClass(id, data) {
  const sets = []; const vals = [];
  for (const k of ['name', 'description', 'time', 'day', 'duration', 'capacity', 'instructor']) {
    if (data[k] !== undefined) { sets.push(k + ' = ?'); vals.push(data[k]); }
  }
  if (data.active !== undefined) { sets.push('active = ?'); vals.push(data.active ? 1 : 0); }
  if (sets.length === 0) return false;
  vals.push(id);
  run('UPDATE classes SET ' + sets.join(', ') + ' WHERE id = ?', vals);
  return true;
}

async function deleteClass(id) {
  return updateClass(id, { active: false });
}

// === Content ===
async function getContent() {
  const rows = query('SELECT key, value FROM content');
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

async function setContent(key, value) {
  const existing = get('SELECT id FROM content WHERE key = ?', [key]);
  if (existing) {
    run('UPDATE content SET value = ? WHERE key = ?', [value, key]);
  } else {
    run('INSERT INTO content (key, value) VALUES (?, ?)', [key, value]);
  }
}

// === Users ===
async function addUser(name, email, passwordHash) {
  run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, passwordHash]);
  const row = get('SELECT id, name, email FROM users WHERE email = ?', [email]);
  return { id: row.id, name: row.name, email: row.email, phone: '' };
}

async function getUserByEmail(email) {
  return get('SELECT id, name, email, password, phone FROM users WHERE email = ?', [email]) || null;
}

async function getUserById(id) {
  const row = get('SELECT id, name, email, phone FROM users WHERE id = ?', [id]);
  return row || null;
}

async function updateUser(id, data) {
  if (data.name !== undefined && data.phone !== undefined) {
    run('UPDATE users SET name = ?, phone = ? WHERE id = ?', [data.name, data.phone, id]);
  } else if (data.name !== undefined) {
    run('UPDATE users SET name = ? WHERE id = ?', [data.name, id]);
  } else if (data.phone !== undefined) {
    run('UPDATE users SET phone = ? WHERE id = ?', [data.phone, id]);
  }
  return true;
}

async function getAllUsers() {
  return query('SELECT id, name, email, phone, created_at FROM users ORDER BY id');
}

// === Bookings ===
async function addBooking(userId, classId, bookingDate) {
  run('INSERT INTO bookings (user_id, class_id, booking_date) VALUES (?, ?, ?)', [userId, classId, bookingDate]);
  const row = get('SELECT id FROM bookings WHERE user_id = ? AND class_id = ? AND booking_date = ?', [userId, classId, bookingDate]);
  return row.id;
}

async function getBookingsByUserId(userId) {
  return query(
    'SELECT b.id, b.class_id, b.booking_date, b.created_at, c.name as class_name, c.time, c.day, c.duration, c.instructor FROM bookings b JOIN classes c ON b.class_id = c.id WHERE b.user_id = ? ORDER BY b.booking_date',
    [userId]
  );
}

async function getBookingCount(classId, bookingDate) {
  const row = get('SELECT COUNT(*) as count FROM bookings WHERE class_id = ? AND booking_date = ?', [classId, bookingDate]);
  return row ? row.count : 0;
}

async function hasExistingBooking(userId, classId, bookingDate) {
  const row = get('SELECT id FROM bookings WHERE user_id = ? AND class_id = ? AND booking_date = ?', [userId, classId, bookingDate]);
  return !!row;
}

async function deleteBooking(bookingId, userId) {
  const row = get('SELECT id FROM bookings WHERE id = ? AND user_id = ?', [bookingId, userId]);
  if (!row) return false;
  run('DELETE FROM bookings WHERE id = ?', [bookingId]);
  return true;
}

async function getAllBookings() {
  return query(
    'SELECT b.id, b.user_id, b.class_id, b.booking_date, b.created_at, c.name as class_name, c.time, c.day, u.name as user_name, u.email as user_email FROM bookings b JOIN classes c ON b.class_id = c.id JOIN users u ON b.user_id = u.id ORDER BY b.created_at'
  );
}

// === Contacts ===
async function addContactMessage(name, email, message) {
  run('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
}

async function getAllContacts() {
  return query('SELECT id, name, email, message, created_at FROM contacts ORDER BY created_at');
}

// === Init ===
async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, phone TEXT DEFAULT '', created_at DATETIME DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
    time TEXT NOT NULL, day TEXT NOT NULL, duration INTEGER DEFAULT 60,
    capacity INTEGER DEFAULT 20, instructor TEXT DEFAULT '', active INTEGER DEFAULT 1
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, class_id INTEGER NOT NULL,
    booking_date TEXT NOT NULL, created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (class_id) REFERENCES classes(id),
    UNIQUE(user_id, class_id, booking_date)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL,
    message TEXT NOT NULL, created_at DATETIME DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL DEFAULT ''
  )`);

  const count = get('SELECT COUNT(*) as count FROM classes');
  if (count.count === 0) {
    const seed = [
      ['Morning Yoga', 'Start your day with energizing yoga flow', '06:00', 'Monday', 60, 25, 'Sarah Johnson'],
      ['HIIT Training', 'High intensity interval training for max burn', '07:00', 'Monday', 45, 20, 'Mike Torres'],
      ['Spin Class', 'Indoor cycling workout with motivating music', '08:00', 'Monday', 45, 15, 'Alex Chen'],
      ['Power Lifting', 'Strength training fundamentals and technique', '06:00', 'Tuesday', 60, 20, 'Mike Torres'],
      ['Cardio Blast', 'Full body cardio workout to boost endurance', '07:00', 'Tuesday', 45, 25, 'Emma Wilson'],
      ['Boxing Fitness', 'Boxing techniques combined with cardio', '08:00', 'Tuesday', 60, 20, 'James Lee'],
      ['Morning Yoga', 'Start your day with energizing yoga flow', '06:00', 'Wednesday', 60, 25, 'Sarah Johnson'],
      ['Pilates', 'Core strength and flexibility training', '07:00', 'Wednesday', 50, 20, 'Emma Wilson'],
      ['Zumba', 'Dance fitness party with Latin rhythms', '08:00', 'Wednesday', 45, 30, 'Lisa Park'],
      ['HIIT Training', 'High intensity interval training for max burn', '06:00', 'Thursday', 45, 20, 'Mike Torres'],
      ['Spin Class', 'Indoor cycling workout with motivating music', '07:00', 'Thursday', 45, 15, 'Alex Chen'],
      ['Power Lifting', 'Strength training fundamentals and technique', '08:00', 'Thursday', 60, 20, 'Mike Torres'],
      ['Morning Yoga', 'Start your day with energizing yoga flow', '06:00', 'Friday', 60, 25, 'Sarah Johnson'],
      ['Cardio Blast', 'Full body cardio workout to boost endurance', '07:00', 'Friday', 45, 25, 'Emma Wilson'],
      ['Boxing Fitness', 'Boxing techniques combined with cardio', '08:00', 'Friday', 60, 20, 'James Lee'],
      ['Weekend Warrior', 'Full body circuit training for all levels', '09:00', 'Saturday', 60, 25, 'Mike Torres'],
      ['Recovery Yoga', 'Gentle stretching and recovery session', '10:00', 'Saturday', 60, 30, 'Sarah Johnson'],
      ['Family Fitness', 'Fun workout suitable for all ages', '09:00', 'Sunday', 45, 30, 'Lisa Park'],
    ];
    const stmt = db.prepare('INSERT INTO classes (name, description, time, day, duration, capacity, instructor) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const c of seed) { stmt.bind(c); stmt.step(); stmt.reset(); }
    stmt.free();
    save();
  }
}

module.exports = {
  init, getClasses, addClass, updateClass, deleteClass,
  getContent, setContent,
  addUser, getUserByEmail, getUserById, updateUser, getAllUsers,
  addBooking, getBookingsByUserId, getBookingCount, hasExistingBooking, deleteBooking, getAllBookings,
  addContactMessage, getAllContacts,
};
