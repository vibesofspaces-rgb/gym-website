const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CACHE_TTL = 30000;

let doc = null;
let cache = {};
let cacheTimers = {};

function cached(key, fetcher) {
  if (cache[key] && cacheTimers[key] > Date.now()) return cache[key];
  return fetcher();
}

async function auth() {
  if (doc) return doc;
  const key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const authClient = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  doc = new GoogleSpreadsheet(SHEET_ID, authClient);
  await doc.loadInfo();
  return doc;
}

async function getSheet(title) {
  const d = await auth();
  return d.sheetsByTitle[title];
}

async function ensureHeaders(sheet, headers) {
  const h = sheet.headerValues || [];
  if (h.length === 0) {
    await sheet.setHeaderRow(headers);
  }
}

async function initSheets() {
  const d = await auth();
  const tabs = {
    Classes: ['id', 'name', 'description', 'time', 'day', 'duration', 'capacity', 'instructor', 'active'],
    Content: ['key', 'value'],
    Users: ['id', 'name', 'email', 'password', 'phone', 'created_at'],
    Bookings: ['id', 'user_id', 'class_id', 'booking_date', 'created_at'],
    Contacts: ['id', 'name', 'email', 'message', 'created_at'],
  };
  for (const [title, headers] of Object.entries(tabs)) {
    if (!d.sheetsByTitle[title]) {
      await d.addWorksheet({ title, headerValues: headers });
    } else {
      const sheet = d.sheetsByTitle[title];
      try {
        await sheet.loadHeaderRow();
      } catch (e) {
        await sheet.setHeaderRow(headers);
      }
    }
  }
}

async function nextId(sheet) {
  const rows = await sheet.getRows();
  if (rows.length === 0) return 1;
  let max = 0;
  for (const r of rows) {
    const v = parseInt(r.get('id') || '0', 10);
    if (v > max) max = v;
  }
  return max + 1;
}

// === CLASSES ===
async function getClasses() {
  const sheet = await getSheet('Classes');
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows.filter(r => r.get('active') !== 'FALSE').map(r => ({
    id: parseInt(r.get('id'), 10),
    name: r.get('name'),
    description: r.get('description'),
    time: r.get('time'),
    day: r.get('day'),
    duration: parseInt(r.get('duration') || '60', 10),
    capacity: parseInt(r.get('capacity') || '20', 10),
    instructor: r.get('instructor'),
  }));
}

async function addClass(data) {
  const sheet = await getSheet('Classes');
  const id = await nextId(sheet);
  await sheet.addRow({
    id: String(id),
    name: data.name,
    description: data.description || '',
    time: data.time,
    day: data.day,
    duration: String(data.duration || 60),
    capacity: String(data.capacity || 20),
    instructor: data.instructor || '',
    active: 'TRUE',
  });
  return id;
}

async function updateClass(id, data) {
  const sheet = await getSheet('Classes');
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (r.get('id') === String(id)) {
      if (data.name !== undefined) r.assign({ name: data.name });
      if (data.description !== undefined) r.assign({ description: data.description });
      if (data.time !== undefined) r.assign({ time: data.time });
      if (data.day !== undefined) r.assign({ day: data.day });
      if (data.duration !== undefined) r.assign({ duration: String(data.duration) });
      if (data.capacity !== undefined) r.assign({ capacity: String(data.capacity) });
      if (data.instructor !== undefined) r.assign({ instructor: data.instructor });
      if (data.active !== undefined) r.assign({ active: data.active ? 'TRUE' : 'FALSE' });
      await r.save();
      return true;
    }
  }
  return false;
}

async function deleteClass(id) {
  return updateClass(id, { active: false });
}

// === CONTENT ===
async function getContent() {
  const sheet = await getSheet('Content');
  if (!sheet) return {};
  const rows = await sheet.getRows();
  const map = {};
  for (const r of rows) map[r.get('key')] = r.get('value');
  return map;
}

async function setContent(key, value) {
  const sheet = await getSheet('Content');
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (r.get('key') === key) {
      r.assign({ value });
      await r.save();
      return;
    }
  }
  await sheet.addRow({ key, value });
}

// === USERS ===
async function addUser(name, email, passwordHash) {
  const sheet = await getSheet('Users');
  const id = await nextId(sheet);
  const now = new Date().toISOString();
  await sheet.addRow({
    id: String(id),
    name,
    email,
    password: passwordHash,
    phone: '',
    created_at: now,
  });
  return { id, name, email, phone: '' };
}

async function getUserByEmail(email) {
  const sheet = await getSheet('Users');
  if (!sheet) return null;
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (r.get('email') === email) {
      return {
        id: parseInt(r.get('id'), 10),
        name: r.get('name'),
        email: r.get('email'),
        password: r.get('password'),
        phone: r.get('phone') || '',
      };
    }
  }
  return null;
}

async function getUserById(id) {
  const sheet = await getSheet('Users');
  if (!sheet) return null;
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (r.get('id') === String(id)) {
      return {
        id: parseInt(r.get('id'), 10),
        name: r.get('name'),
        email: r.get('email'),
        phone: r.get('phone') || '',
      };
    }
  }
  return null;
}

async function updateUser(id, data) {
  const sheet = await getSheet('Users');
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (r.get('id') === String(id)) {
      if (data.name !== undefined) r.assign({ name: data.name });
      if (data.phone !== undefined) r.assign({ phone: data.phone });
      await r.save();
      return true;
    }
  }
  return false;
}

async function getAllUsers() {
  const sheet = await getSheet('Users');
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows.map(r => ({
    id: parseInt(r.get('id'), 10),
    name: r.get('name'),
    email: r.get('email'),
    phone: r.get('phone') || '',
    created_at: r.get('created_at'),
  }));
}

// === BOOKINGS ===
async function addBooking(userId, classId, bookingDate) {
  const sheet = await getSheet('Bookings');
  const id = await nextId(sheet);
  const now = new Date().toISOString();
  await sheet.addRow({
    id: String(id),
    user_id: String(userId),
    class_id: String(classId),
    booking_date: bookingDate,
    created_at: now,
  });
  return id;
}

async function getBookingsByUserId(userId) {
  const sheet = await getSheet('Bookings');
  if (!sheet) return [];
  const rows = await sheet.getRows();
  const classes = await getClasses();
  const classMap = {};
  for (const c of classes) classMap[c.id] = c;

  return rows
    .filter(r => r.get('user_id') === String(userId))
    .map(r => {
      const cls = classMap[parseInt(r.get('class_id'), 10)];
      return {
        id: parseInt(r.get('id'), 10),
        class_id: parseInt(r.get('class_id'), 10),
        booking_date: r.get('booking_date'),
        created_at: r.get('created_at'),
        class_name: cls ? cls.name : 'Unknown',
        time: cls ? cls.time : '',
        day: cls ? cls.day : '',
        duration: cls ? cls.duration : 0,
        instructor: cls ? cls.instructor : '',
      };
    });
}

async function getBookingCount(classId, bookingDate) {
  const sheet = await getSheet('Bookings');
  if (!sheet) return 0;
  const rows = await sheet.getRows();
  let count = 0;
  for (const r of rows) {
    if (r.get('class_id') === String(classId) && r.get('booking_date') === bookingDate) {
      count++;
    }
  }
  return count;
}

async function hasExistingBooking(userId, classId, bookingDate) {
  const sheet = await getSheet('Bookings');
  if (!sheet) return false;
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (r.get('user_id') === String(userId) && r.get('class_id') === String(classId) && r.get('booking_date') === bookingDate) {
      return true;
    }
  }
  return false;
}

async function deleteBooking(bookingId, userId) {
  const sheet = await getSheet('Bookings');
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (r.get('id') === String(bookingId) && r.get('user_id') === String(userId)) {
      await r.delete();
      return true;
    }
  }
  return false;
}

async function getAllBookings() {
  const sheet = await getSheet('Bookings');
  if (!sheet) return [];
  const rows = await sheet.getRows();
  const classes = await getClasses();
  const users = await getAllUsers();
  const classMap = {}, userMap = {};
  for (const c of classes) classMap[c.id] = c;
  for (const u of users) userMap[u.id] = u;

  return rows.map(r => {
    const uid = parseInt(r.get('user_id'), 10);
    const cid = parseInt(r.get('class_id'), 10);
    const cls = classMap[cid];
    const usr = userMap[uid];
    return {
      id: parseInt(r.get('id'), 10),
      user_id: uid,
      class_id: cid,
      booking_date: r.get('booking_date'),
      created_at: r.get('created_at'),
      class_name: cls ? cls.name : 'Unknown',
      time: cls ? cls.time : '',
      day: cls ? cls.day : '',
      user_name: usr ? usr.name : 'Unknown',
      user_email: usr ? usr.email : '',
    };
  });
}

// === CONTACTS ===
async function addContactMessage(name, email, message) {
  const sheet = await getSheet('Contacts');
  const id = await nextId(sheet);
  const now = new Date().toISOString();
  await sheet.addRow({
    id: String(id),
    name,
    email,
    message,
    created_at: now,
  });
  return id;
}

async function getAllContacts() {
  const sheet = await getSheet('Contacts');
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows.map(r => ({
    id: parseInt(r.get('id'), 10),
    name: r.get('name'),
    email: r.get('email'),
    message: r.get('message'),
    created_at: r.get('created_at'),
  }));
}

module.exports = {
  init: initSheets, getClasses, addClass, updateClass, deleteClass,
  getContent, setContent,
  addUser, getUserByEmail, getUserById, updateUser, getAllUsers,
  addBooking, getBookingsByUserId, getBookingCount, hasExistingBooking, deleteBooking, getAllBookings,
  addContactMessage, getAllContacts,
};
