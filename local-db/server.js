/* ============================================================
   Triple 7 Holdings — Trade Desk API on MySQL
   ------------------------------------------------------------
   Loaded by serve.js. Answers everything under /api and keeps the
   data in a normal MySQL (or MariaDB) database.

   First start:
     1. MySQL must be running (XAMPP, WAMP, MySQL Installer …)
     2. npm install          (once — fetches the mysql2 driver)
     3. node serve.js

   On start it creates the database and tables if they are missing
   (schema.sql) and, if there are no accounts yet, loads the test
   data (seed.json). Connection details are in config.json.

   Who may do what is decided HERE, on the server, before any SQL
   runs. The browser cannot skip these checks:

     - passwords are stored hashed (scrypt), never as text
     - a new lot always starts "pending"; only an admin approves it
     - buyers enquire, sellers list, neither can do the other
     - nobody becomes an admin through the website. Use:
           node local-db/admin.js make-admin someone@example.com

   Every query uses placeholders (?), so nothing a visitor types is
   ever pasted into SQL.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DAY = 86400000;
const COMMODITIES = { diamond: 'D', gold: 'G', platinum: 'P', silver: 'S', ruby: 'R', sapphire: 'SA', emerald: 'E', tanzanite: 'T' };

/* ---------- Connection ---------- */
function readConfig() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch (e) {}
  /* Environment variables win, so a password need not live in a file. */
  return {
    host: process.env.DB_HOST || file.host || 'localhost',
    port: Number(process.env.DB_PORT || file.port || 3306),
    user: process.env.DB_USER || file.user || 'root',
    password: process.env.DB_PASSWORD != null ? process.env.DB_PASSWORD : (file.password || ''),
    database: process.env.DB_NAME || file.database || 'triple7'
  };
}

let pool = null;
let startError = null;

function explain(err) {
  const c = readConfig();
  if (err && err.code === 'MODULE_NOT_FOUND') return 'The MySQL driver is not installed. Run:  npm install';
  if (err && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT'))
    return 'MySQL is not running on ' + c.host + ':' + c.port + '. Start MySQL (for example in the XAMPP control panel), then start this again.';
  if (err && (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_DBACCESS_DENIED_ERROR'))
    return 'MySQL refused the user "' + c.user + '". Put the right user and password in local-db/config.json.';
  return 'MySQL error: ' + ((err && err.message) || err);
}

/* Connects, creates the database and tables if needed, seeds if empty. */
async function init() {
  if (pool) return pool;
  const mysql = require('mysql2/promise');
  const c = readConfig();
  if (!/^[A-Za-z0-9_]+$/.test(c.database)) throw new Error('The database name may only use letters, numbers and _.');

  const first = await mysql.createConnection({ host: c.host, port: c.port, user: c.user, password: c.password });
  await first.query('CREATE DATABASE IF NOT EXISTS `' + c.database + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await first.end();

  const p = mysql.createPool({
    host: c.host, port: c.port, user: c.user, password: c.password, database: c.database,
    waitForConnections: true, connectionLimit: 5,
    timezone: 'Z',            // dates go in and come out as UTC
    decimalNumbers: true,     // prices as numbers, not strings
    charset: 'utf8mb4'
  });
  /* Make the server's own clock (CURRENT_TIMESTAMP) UTC as well. */
  p.on('connection', conn => conn.query("SET time_zone = '+00:00'"));

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    .split('\n').filter(line => !/^\s*--/.test(line)).join('\n');
  for (const statement of schema.split(/;\s*\n/)) {
    if (statement.trim()) await p.query(statement);
  }

  pool = p;
  const [[{ n }]] = await p.query('SELECT COUNT(*) AS n FROM profiles');
  if (n === 0) await seed();
  return pool;
}

async function q(sql, params) {
  const [rows] = await pool.query(sql, params || []);
  return rows;
}
async function one(sql, params) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

/* ---------- Passwords ---------- */
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  return s + ':' + crypto.scryptSync(String(password), s, 32).toString('hex');
}
function checkPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const a = Buffer.from(hashPassword(password, parts[0]));
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- Test data ---------- */
async function seed() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
  const now = Date.now();
  const ago = (days, hours) => new Date(now - days * DAY - (hours || 0) * 3600000);
  const pw = hashPassword(data.password);
  const admin = data.users.find(u => u.role === 'admin');

  for (const u of data.users) {
    await q('INSERT INTO profiles (id, email, password_hash, role, first_name, last_name, phone, country, company, status, verified, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)',
      [u.id, u.email, pw, u.role, u.first_name, u.last_name, u.phone, u.country, u.company || null, u.status, ago(u.days), ago(u.days)]);
  }

  for (const l of data.lots) {
    const created = ago(l.days, l.hours);
    const reviewed = l.status === 'pending' ? null : new Date(Math.min(now, created.getTime() + 9 * 3600000));
    const res = await q('INSERT INTO lots (id, seller_id, commodity, name, type, description, price_zar, weight, weight_unit, quantity, origin, specs, status, review_note, reviewed_by, reviewed_at, image, image_card, image_alt, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [l.id, l.seller_id, l.commodity, l.name, l.type, l.description, l.price_zar, l.weight, l.weight_unit, l.quantity, l.origin,
       JSON.stringify(l.specs), l.status, l.review_note || null, reviewed ? admin.id : null, reviewed, l.image, l.image_card, l.image_alt, created, reviewed || created]);
    await q('UPDATE lots SET lot_id = ? WHERE id = ?', [COMMODITIES[l.commodity] + '-' + res.insertId, l.id]);
    const docStatus = { pending: 'pending', rejected: 'rejected' }[l.status] || 'approved';
    await q('INSERT INTO seller_documents (id, seller_id, lot_id, status, review_note, reviewed_by, reviewed_at, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [crypto.randomUUID(), l.seller_id, l.id, docStatus, docStatus === 'rejected' ? 'Document was blank.' : null, reviewed ? admin.id : null, reviewed, created]);
  }

  const ordered = data.enquiries.slice().sort((a, b) => (b.days * 24 + b.hours) - (a.days * 24 + a.hours));
  for (const e of ordered) {
    const buyer = data.users.find(u => u.id === e.buyer_id);
    const lot = data.lots.find(l => l.id === e.lot_id);
    const id = crypto.randomUUID();
    const created = ago(e.days, e.hours);
    const res = await q('INSERT INTO enquiries (id, lot_id, buyer_id, seller_id, buyer_name, buyer_email, buyer_phone, message, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, lot.id, buyer.id, lot.seller_id, (buyer.first_name + ' ' + buyer.last_name).trim(), buyer.email, buyer.phone, e.message, e.status, created, created]);
    await q('UPDATE enquiries SET ref = ? WHERE id = ?', ['ENQ-' + res.insertId, id]);
  }

  for (const a of data.alerts) {
    await q('INSERT INTO lot_alerts (id, email, interests, created_at) VALUES (?,?,?,?)', [crypto.randomUUID(), a.email, a.interests.join(','), ago(a.days)]);
  }
  console.log('Test data loaded: ' + data.users.length + ' accounts, ' + data.lots.length + ' lots, ' + data.enquiries.length + ' enquiries.');
}

/* ---------- Shaping rows for the browser ---------- */
class Refuse extends Error {}
const refuse = message => { throw new Refuse(message); };
const clean = v => (v == null ? '' : String(v).trim());
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/* Never the password hash or the confirmation token. */
const PROFILE_COLS = 'id, email, role, first_name, last_name, phone, country, company, status, created_at, updated_at';

function lotRow(l) {
  if (!l) return null;
  /* MySQL returns JSON columns as objects, MariaDB as text. */
  if (typeof l.specs === 'string') { try { l.specs = JSON.parse(l.specs); } catch (e) { l.specs = {}; } }
  if (!l.specs) l.specs = {};
  delete l.lot_number;
  return l;
}
function alertRow(a) { a.interests = String(a.interests || '').split(',').filter(Boolean); return a; }
function enquiryRow(e) { delete e.enquiry_number; return e; }

/* An enquiry with a small summary of its lot attached, as the pages expect. */
const ENQ_WITH_LOT =
  'SELECT e.*, l.lot_id AS l_lot_id, l.name AS l_name, l.commodity AS l_commodity, l.price_zar AS l_price, l.status AS l_status ' +
  'FROM enquiries e LEFT JOIN lots l ON l.id = e.lot_id ';
function withLot(r) {
  const lot = r.l_lot_id ? { id: r.lot_id, lot_id: r.l_lot_id, name: r.l_name, commodity: r.l_commodity, price_zar: r.l_price, status: r.l_status } : null;
  ['l_lot_id', 'l_name', 'l_commodity', 'l_price', 'l_status'].forEach(k => delete r[k]);
  r.lot = lot;
  return enquiryRow(r);
}

function need(me, roles) {
  if (!me) refuse('Please sign in first.');
  if (me.status !== 'active') refuse('This account is on hold.');
  if (roles && roles.indexOf(me.role) === -1) refuse('Your account is not allowed to do that.');
}

async function startSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await q('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, userId]);
  return token;
}

async function whoIs(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return one('SELECT p.id, p.email, p.role, p.first_name, p.last_name, p.phone, p.country, p.company, p.status, p.created_at, p.updated_at ' +
             'FROM sessions s JOIN profiles p ON p.id = s.user_id WHERE s.token = ? AND s.created_at > (UTC_TIMESTAMP(3) - INTERVAL 30 DAY)', [token]);
}

function verifyLink(ctx, token, next) {
  return ctx.origin + '/api/verify?token=' + token + (next ? '&next=' + encodeURIComponent(next) : '');
}

/* ---------- Everything the website can ask for ----------
   Each function gets (args, me, ctx). `me` is the signed-in account
   worked out from the session token, or null. */
const FN = {
  /* ----- accounts ----- */
  async signUp(a, me, ctx) {
    const email = clean(a.email).toLowerCase();
    if (!EMAIL.test(email)) refuse('That email address does not look right.');
    if (clean(a.password).length < 8) refuse('Choose a longer password (at least 8 characters).');
    if (clean(a.first_name).length < 2 || clean(a.last_name).length < 2) refuse('Please enter your first name and surname.');
    if (await one('SELECT id FROM profiles WHERE email = ?', [email])) refuse('An account with that email already exists. Sign in instead.');
    const token = crypto.randomBytes(24).toString('hex');
    await q('INSERT INTO profiles (id, email, password_hash, role, first_name, last_name, phone, country, company, verified, verify_token) VALUES (?,?,?,?,?,?,?,?,?,0,?)',
      [crypto.randomUUID(), email, hashPassword(a.password),
       a.role === 'seller' ? 'seller' : 'buyer',                 // never admin from the website
       clean(a.first_name), clean(a.last_name), clean(a.phone) || null, clean(a.country) || null, clean(a.company) || null, token]);
    const link = verifyLink(ctx, token, a.next);
    console.log('\n  Confirmation link for ' + email + ':\n  ' + link + '\n');
    /* No real email is sent from your own computer, so the link is handed
       back and the "check your inbox" screen offers it as a link. */
    return { needsVerification: true, devLink: link };
  },

  async resend(a, me, ctx) {
    const p = await one('SELECT email, verify_token FROM profiles WHERE email = ? AND verified = 0', [clean(a.email).toLowerCase()]);
    if (!p) return { devLink: null };
    const link = verifyLink(ctx, p.verify_token, a.next);
    console.log('\n  Confirmation link for ' + p.email + ':\n  ' + link + '\n');
    return { devLink: link };
  },

  async signIn(a) {
    const p = await one('SELECT id, password_hash, verified FROM profiles WHERE email = ?', [clean(a.email).toLowerCase()]);
    if (!p || !checkPassword(a.password, p.password_hash)) refuse('That email and password do not match an account.');
    if (!p.verified) refuse('Please confirm your email first. Check your inbox for the link we sent.');
    return { token: await startSession(p.id) };
  },

  async signOut(a, me, ctx) {
    if (ctx.token) await q('DELETE FROM sessions WHERE token = ?', [ctx.token]);
    return true;
  },

  async me(a, me) { return me; },

  async completeProfile(a, me) {
    if (!me) refuse('Sign in first.');
    /* The role can be chosen once (buyer or seller) and never changed here. */
    const role = !me.role && (a.role === 'buyer' || a.role === 'seller') ? a.role : me.role;
    await q('UPDATE profiles SET role = ?, first_name = ?, last_name = ?, phone = ?, country = ?, company = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
      [role, clean(a.first_name) || me.first_name, clean(a.last_name) || me.last_name, clean(a.phone) || me.phone,
       clean(a.country) || me.country, clean(a.company) || me.company, me.id]);
    return one('SELECT ' + PROFILE_COLS + ' FROM profiles WHERE id = ?', [me.id]);
  },

  /* ----- the board ----- */
  async listLots(a, me) {
    need(me);
    return (await q("SELECT * FROM lots WHERE status = 'live' ORDER BY created_at DESC")).map(lotRow);
  },

  async getLot(a, me) {
    need(me);
    const l = lotRow(await one('SELECT * FROM lots WHERE lot_id = ?', [clean(a.lot_id)]));
    if (!l) return null;
    return (l.status === 'live' || l.seller_id === me.id || me.role === 'admin') ? l : null;
  },

  /* ----- buyers ----- */
  async sendEnquiry(a, me) {
    need(me, ['buyer']);
    const lot = await one('SELECT id, seller_id, status FROM lots WHERE id = ?', [clean(a.lot_id)]);
    if (!lot) refuse('That lot does not exist.');
    if (lot.status !== 'live') refuse('This lot is no longer open for enquiries.');
    if (clean(a.message).length < 2) refuse('Write a short message for the seller first.');
    const id = crypto.randomUUID();
    /* Name, email and phone come from the buyer's own profile, not from
       anything the browser sends. */
    const res = await q('INSERT INTO enquiries (id, lot_id, buyer_id, seller_id, buyer_name, buyer_email, buyer_phone, message) VALUES (?,?,?,?,?,?,?,?)',
      [id, lot.id, me.id, lot.seller_id, (clean(me.first_name) + ' ' + clean(me.last_name)).trim(), me.email, me.phone, clean(a.message).slice(0, 1500)]);
    await q('UPDATE enquiries SET ref = ? WHERE id = ?', ['ENQ-' + res.insertId, id]);
    return enquiryRow(await one('SELECT * FROM enquiries WHERE id = ?', [id]));
  },

  async myEnquiries(a, me) {
    need(me);
    return (await q(ENQ_WITH_LOT + 'WHERE e.buyer_id = ? ORDER BY e.created_at DESC', [me.id])).map(withLot).map(e => {
      if (e.lot && e.lot.status !== 'live') e.lot = null;        // a buyer cannot see lots that left the board
      return e;
    });
  },

  /* ----- sellers ----- */
  async myLots(a, me) {
    need(me, ['seller']);
    return (await q('SELECT * FROM lots WHERE seller_id = ? ORDER BY created_at DESC', [me.id])).map(lotRow);
  },

  async createLot(a, me) {
    need(me, ['seller']);
    if (!COMMODITIES[a.commodity]) refuse('Choose what you are selling.');
    if (clean(a.name).length < 3) refuse('Give the listing a title.');
    if (!(Number(a.price_zar) > 0)) refuse('Enter your asking price in rand.');
    if (a.weight != null && a.weight !== '' && !(Number(a.weight) > 0)) refuse('Enter the weight.');
    const id = crypto.randomUUID();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      /* status is not in this list on purpose: the column default is
         "pending", and only an admin can change it. */
      const [res] = await conn.query('INSERT INTO lots (id, seller_id, commodity, name, type, description, price_zar, weight, weight_unit, quantity, origin, specs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [id, me.id, a.commodity, clean(a.name).slice(0, 90), clean(a.type) || null, clean(a.description).slice(0, 1200) || null,
         Math.round(Number(a.price_zar) * 100) / 100, a.weight != null && a.weight !== '' ? Number(a.weight) : null,
         a.weight_unit === 'g' ? 'g' : 'ct', Math.max(1, Math.floor(Number(a.quantity) || 1)), clean(a.origin) || null,
         JSON.stringify(a.specs && typeof a.specs === 'object' ? a.specs : {})]);
      await conn.query('UPDATE lots SET lot_id = ? WHERE id = ?', [COMMODITIES[a.commodity] + '-' + res.insertId, id]);
      /* The empty supporting document that goes with every listing. */
      await conn.query('INSERT INTO seller_documents (id, seller_id, lot_id) VALUES (?,?,?)', [crypto.randomUUID(), me.id, id]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    return lotRow(await one('SELECT * FROM lots WHERE id = ?', [id]));
  },

  async setLotStatus(a, me) {
    need(me, ['seller']);
    const lot = await one('SELECT id, status FROM lots WHERE id = ? AND seller_id = ?', [clean(a.id), me.id]);
    if (!lot) refuse('This is not your listing.');
    const allowed = (a.status === 'withdrawn' && ['pending', 'live', 'rejected'].indexOf(lot.status) !== -1) ||
                    (a.status === 'sold' && lot.status === 'live');
    if (!allowed) refuse('That status change is not allowed.');
    await q('UPDATE lots SET status = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [a.status, lot.id]);
    return lotRow(await one('SELECT * FROM lots WHERE id = ?', [lot.id]));
  },

  async myDocuments(a, me) {
    need(me, ['seller']);
    return q('SELECT * FROM seller_documents WHERE seller_id = ?', [me.id]);
  },

  async sellerEnquiries(a, me) {
    need(me, ['seller']);
    return (await q(ENQ_WITH_LOT + 'WHERE e.seller_id = ? ORDER BY e.created_at DESC', [me.id])).map(withLot);
  },

  async setEnquiryStatus(a, me) {
    need(me, ['seller', 'admin']);
    if (['new', 'answered', 'closed'].indexOf(a.status) === -1) refuse('Unknown status.');
    const e = await one('SELECT id, seller_id FROM enquiries WHERE id = ?', [clean(a.id)]);
    if (!e || (me.role === 'seller' && e.seller_id !== me.id)) refuse('This is not your enquiry.');
    await q('UPDATE enquiries SET status = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [a.status, e.id]);
    return enquiryRow(await one('SELECT * FROM enquiries WHERE id = ?', [e.id]));
  },

  /* ----- admin ----- */
  async adminLoad(a, me) {
    need(me, ['admin']);
    const [profiles, lots, enquiries, documents, alerts] = await Promise.all([
      q('SELECT ' + PROFILE_COLS + ' FROM profiles ORDER BY created_at DESC'),
      q('SELECT * FROM lots ORDER BY created_at DESC'),
      q('SELECT * FROM enquiries ORDER BY created_at DESC'),
      q('SELECT * FROM seller_documents ORDER BY created_at DESC'),
      q('SELECT * FROM lot_alerts ORDER BY created_at DESC')
    ]);
    return { profiles: profiles, lots: lots.map(lotRow), enquiries: enquiries.map(enquiryRow), documents: documents, alerts: alerts.map(alertRow) };
  },

  async reviewLot(a, me) {
    need(me, ['admin']);
    if (['live', 'rejected', 'pending', 'sold', 'withdrawn'].indexOf(a.status) === -1) refuse('Unknown status.');
    const res = await q('UPDATE lots SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
      [a.status, clean(a.note) || null, me.id, clean(a.id)]);
    if (!res.affectedRows) refuse('That lot does not exist.');
    return lotRow(await one('SELECT * FROM lots WHERE id = ?', [clean(a.id)]));
  },

  async deleteLot(a, me) {
    need(me, ['admin']);
    await q('DELETE FROM lots WHERE id = ?', [clean(a.id)]);      // its document and enquiries go with it
    return true;
  },

  async reviewDocument(a, me) {
    need(me, ['admin']);
    if (['pending', 'approved', 'rejected'].indexOf(a.status) === -1) refuse('Unknown status.');
    const res = await q('UPDATE seller_documents SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(3) WHERE id = ?',
      [a.status, clean(a.note) || null, me.id, clean(a.id)]);
    if (!res.affectedRows) refuse('That document does not exist.');
    return one('SELECT * FROM seller_documents WHERE id = ?', [clean(a.id)]);
  },

  async setUserStatus(a, me) {
    need(me, ['admin']);
    if (a.id === me.id) refuse('You cannot suspend your own account.');
    if (a.status !== 'active' && a.status !== 'suspended') refuse('Status must be active or suspended.');
    const res = await q("UPDATE profiles SET status = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ? AND (role IS NULL OR role <> 'admin')", [a.status, clean(a.id)]);
    if (!res.affectedRows) refuse('Account not found, or it is an admin account.');
    if (a.status === 'suspended') await q('DELETE FROM sessions WHERE user_id = ?', [clean(a.id)]);
    return one('SELECT ' + PROFILE_COLS + ' FROM profiles WHERE id = ?', [clean(a.id)]);
  },

  /* Removes an account for good, with its lots, documents, enquiries
     and sessions. Admin accounts can only be removed from the terminal. */
  async deleteUser(a, me) {
    need(me, ['admin']);
    if (a.id === me.id) refuse('You cannot delete your own account.');
    const res = await q("DELETE FROM profiles WHERE id = ? AND (role IS NULL OR role <> 'admin')", [clean(a.id)]);
    if (!res.affectedRows) refuse('Account not found, or it is an admin account.');
    return true;
  },

  /* ----- anyone ----- */
  async subscribe(a) {
    const email = clean(a.email).toLowerCase();
    if (!EMAIL.test(email)) refuse('That email address does not look right.');
    const interests = (Array.isArray(a.interests) && a.interests.length ? a.interests : ['diamond', 'gold'])
      .filter(i => COMMODITIES[i]).join(',') || 'diamond,gold';
    await q('INSERT INTO lot_alerts (id, email, interests) VALUES (?,?,?) ON DUPLICATE KEY UPDATE interests = VALUES(interests)',
      [crypto.randomUUID(), email, interests]);
    return true;       // same answer either way, so the list cannot be probed
  }
};

/* ---------- HTTP ----------
   serve.js calls this for every request; it answers /api/... and
   returns false for everything else. */
function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.indexOf('/api/') !== 0) return false;
  const origin = 'http://' + (req.headers.host || 'localhost');
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  if (!pool) {
    send(503, { error: startError || 'The database is still starting. Try again in a moment.' });
    return true;
  }

  /* The link from the "confirmation email". Confirms the account,
     signs it in, and hands the session to signin.html. */
  if (url.pathname === '/api/verify' && req.method === 'GET') {
    const next = url.searchParams.get('next');
    const back = '/signin.html' + (next ? '?next=' + encodeURIComponent(next) : '');
    const token = clean(url.searchParams.get('token'));
    (async () => {
      const p = token ? await one('SELECT id FROM profiles WHERE verify_token = ?', [token]) : null;
      if (!p) {
        res.writeHead(303, { Location: back + '#error_description=' + encodeURIComponent('This confirmation link is invalid or has already been used') });
        return res.end();
      }
      await q('UPDATE profiles SET verified = 1, verify_token = NULL WHERE id = ?', [p.id]);
      res.writeHead(303, { Location: back + '#local_token=' + await startSession(p.id) });
      res.end();
    })().catch(e => { console.error(e); send(500, { error: 'Something went wrong. See the terminal.' }); });
    return true;
  }

  if (url.pathname === '/api/ping') { send(200, { ok: true, local: true }); return true; }

  if (url.pathname !== '/api/rpc' || req.method !== 'POST') { send(404, { error: 'Not found.' }); return true; }

  let raw = '';
  req.on('data', chunk => { raw += chunk; if (raw.length > 200000) req.destroy(); });
  req.on('end', async () => {
    let body;
    try { body = JSON.parse(raw || '{}'); } catch (e) { return send(400, { error: 'Bad request.' }); }
    const fn = Object.prototype.hasOwnProperty.call(FN, body.fn) ? FN[body.fn] : null;
    if (!fn) return send(404, { error: 'Unknown request.' });
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
    try {
      const me = await whoIs(token);
      send(200, { data: await fn(body.args || {}, me, { token: token, origin: origin }) });
    } catch (e) {
      if (e instanceof Refuse) return send(400, { error: e.message });
      console.error(e);
      send(500, { error: 'The database hit an error. See the terminal.' });
    }
  });
  return true;
}

/* Called once by serve.js. Never throws: if MySQL is not reachable the
   site still serves its pages and /api explains what is wrong. */
async function start() {
  try {
    await init();
    const c = readConfig();
    console.log('MySQL connected: database "' + c.database + '" on ' + c.host + ':' + c.port + '  (test password: Triple7-Test!)');
    return true;
  } catch (e) {
    startError = explain(e);
    console.error('\n  DATABASE NOT CONNECTED\n  ' + startError + '\n');
    return false;
  }
}

module.exports = { handle, start, init, explain, readConfig, hashPassword, q: (s, p) => q(s, p), one: (s, p) => one(s, p), end: () => pool && pool.end() };
