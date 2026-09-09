/**
 * db.js - Persistent Database Layer using native Node.js SQLite (DatabaseSync)
 * Creates tables, handles migrations, and provides data access methods.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path configuration (supports custom path and Vercel serverless /tmp fallback)
let dbPath = process.env.DATABASE_PATH;
if (!dbPath) {
  if (process.env.VERCEL) {
    dbPath = path.join('/tmp', 'hisabo.sqlite');
  } else {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
    }
    dbPath = path.join(dataDir, 'hisabo.sqlite');
  }
}
const db = new DatabaseSync(dbPath);

// Performance & Integrity settings
if (process.env.VERCEL) {
  try { db.exec('PRAGMA journal_mode = DELETE;'); } catch (e) {}
} else {
  try { db.exec('PRAGMA journal_mode = WAL;'); } catch (e) {}
}
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    provider TEXT DEFAULT 'google',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    month_key TEXT NOT NULL,
    item TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_user_month ON expenses(user_id, month_key);
  CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);

  CREATE TABLE IF NOT EXISTS budgets (
    user_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    amount REAL NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, month_key),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS budget_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    sent_at INTEGER NOT NULL,
    spent_amount REAL NOT NULL,
    budget_amount REAL NOT NULL,
    recipient_email TEXT NOT NULL,
    is_simulated INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, month_key, threshold)
  );

  CREATE INDEX IF NOT EXISTS idx_budget_alerts_user_month ON budget_alerts(user_id, month_key);

  CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    purpose TEXT DEFAULT 'signup_verification',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    expires_at INTEGER NOT NULL,
    resend_available_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes(email);

  CREATE TABLE IF NOT EXISTS signup_verifications (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_signup_verif_email ON signup_verifications(email);
`);

// Migrations: Ensure newer columns exist in older databases
try {
  db.exec('ALTER TABLE budget_alerts ADD COLUMN is_simulated INTEGER DEFAULT 0;');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN password_salt TEXT;');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0;');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN verified_at INTEGER;');
} catch (e) {}

console.log('[Hisabo DB] SQLite Database initialized at:', dbPath);

// ==============================================================================
// Data Access Layer (DAO)
// ==============================================================================

export const userDAO = {
  findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email.toLowerCase().trim());
  },

  findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  },

  createUser({ id, email, name, picture, passwordHash = null, passwordSalt = null, isVerified = 0, provider = 'gmail' }) {
    const cleanEmail = email.toLowerCase().trim();
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO users (id, email, name, picture, provider, password_hash, password_salt, is_verified, verified_at, created_at, last_login)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    stmt.run(
      id,
      cleanEmail,
      name || null,
      picture || null,
      provider,
      passwordHash || null,
      passwordSalt || null,
      isVerified ? 1 : 0,
      isVerified ? now : null
    );
    return this.findById(id);
  },

  updateUnverifiedUser(email, { name, passwordHash, passwordSalt }) {
    const cleanEmail = email.toLowerCase().trim();
    const stmt = db.prepare(`
      UPDATE users 
      SET name = COALESCE(?, name),
          password_hash = COALESCE(?, password_hash),
          password_salt = COALESCE(?, password_salt),
          last_login = CURRENT_TIMESTAMP
      WHERE email = ? AND is_verified = 0
    `);
    stmt.run(name || null, passwordHash || null, passwordSalt || null, cleanEmail);
    return this.findByEmail(cleanEmail);
  },

  markVerified(email) {
    const cleanEmail = email.toLowerCase().trim();
    const now = Date.now();
    const stmt = db.prepare(`
      UPDATE users 
      SET is_verified = 1, verified_at = ?, last_login = CURRENT_TIMESTAMP 
      WHERE email = ?
    `);
    stmt.run(now, cleanEmail);
    return this.findByEmail(cleanEmail);
  },

  updatePassword(email, passwordHash, passwordSalt) {
    const cleanEmail = email.toLowerCase().trim();
    const stmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_salt = ? 
      WHERE email = ?
    `);
    stmt.run(passwordHash, passwordSalt, cleanEmail);
    return this.findByEmail(cleanEmail);
  },

  updateLastLogin(id) {
    const stmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);
  },

  upsertUser({ id, email, name, picture, provider = 'google' }) {
    const cleanEmail = email.toLowerCase().trim();
    const existing = this.findByEmail(cleanEmail);

    if (existing) {
      const stmt = db.prepare(`
        UPDATE users 
        SET name = COALESCE(?, name), picture = COALESCE(?, picture), is_verified = 1, last_login = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      stmt.run(name || existing.name || null, picture || existing.picture || null, existing.id);
      return this.findById(existing.id);
    } else {
      const stmt = db.prepare(`
        INSERT INTO users (id, email, name, picture, provider, is_verified, verified_at, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      stmt.run(id, cleanEmail, name || null, picture || null, provider || 'google', Date.now());
      return this.findById(id);
    }
  }
};

export const verificationDAO = {
  createCode({ id, email, otpHash, salt, purpose = 'signup_verification', expiresMinutes = 10, cooldownSeconds = 60 }) {
    const cleanEmail = email.toLowerCase().trim();
    const now = Date.now();
    const expiresAt = now + (expiresMinutes * 60 * 1000);
    const resendAvailableAt = now + (cooldownSeconds * 1000);
    const codeId = id || ('code_' + now + '_' + Math.random().toString(36).substring(2, 8));

    // Invalidate prior codes for this email and purpose
    this.deleteForEmail(cleanEmail, purpose);

    const stmt = db.prepare(`
      INSERT INTO verification_codes (id, email, otp_hash, salt, purpose, attempts, max_attempts, expires_at, resend_available_at, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 5, ?, ?, ?)
    `);
    stmt.run(codeId, cleanEmail, otpHash, salt, purpose, expiresAt, resendAvailableAt, now);

    return {
      id: codeId,
      email: cleanEmail,
      purpose,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      maxAttempts: 5
    };
  },

  getLatest(email, purpose = 'signup_verification') {
    const cleanEmail = email.toLowerCase().trim();
    const stmt = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE email = ? AND purpose = ?
      ORDER BY created_at DESC LIMIT 1
    `);
    const r = stmt.get(cleanEmail, purpose);
    if (!r) return null;
    return {
      id: r.id,
      email: r.email,
      otpHash: r.otp_hash,
      salt: r.salt,
      purpose: r.purpose,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      expiresAt: r.expires_at,
      resendAvailableAt: r.resend_available_at,
      createdAt: r.created_at
    };
  },

  incrementAttempts(id) {
    const stmt = db.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?');
    stmt.run(id);
    const checkStmt = db.prepare('SELECT attempts, max_attempts FROM verification_codes WHERE id = ?');
    return checkStmt.get(id);
  },

  deleteForEmail(email, purpose = 'signup_verification') {
    const cleanEmail = email.toLowerCase().trim();
    const stmt = db.prepare('DELETE FROM verification_codes WHERE email = ? AND purpose = ?');
    stmt.run(cleanEmail, purpose);
  }
};

export const signupVerificationDAO = {
  create({ token, email, expiresMinutes = 15 }) {
    const cleanEmail = email.toLowerCase().trim();
    const now = Date.now();
    const expiresAt = now + expiresMinutes * 60 * 1000;

    // Delete any older unused tokens for this email
    try {
      db.prepare('DELETE FROM signup_verifications WHERE email = ? AND used = 0').run(cleanEmail);
    } catch (e) {}

    const stmt = db.prepare(`
      INSERT INTO signup_verifications (token, email, expires_at, used, created_at)
      VALUES (?, ?, ?, 0, ?)
    `);
    stmt.run(token, cleanEmail, expiresAt, now);
    return { token, email: cleanEmail, expiresAt };
  },

  getValid(token, email) {
    if (!token || !email) return null;
    const cleanEmail = email.toLowerCase().trim();
    const now = Date.now();
    const stmt = db.prepare(`
      SELECT * FROM signup_verifications 
      WHERE token = ? AND email = ? AND used = 0 AND expires_at > ?
    `);
    return stmt.get(token, cleanEmail, now);
  },

  markUsed(token) {
    const stmt = db.prepare('UPDATE signup_verifications SET used = 1 WHERE token = ?');
    stmt.run(token);
  },

  cleanupExpired() {
    const now = Date.now();
    try {
      db.prepare('DELETE FROM signup_verifications WHERE expires_at < ? OR used = 1').run(now);
    } catch (e) {}
  }
};

export const sessionDAO = {
  createSession(token, userId, expiresInDays = 30) {
    const now = Date.now();
    const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;
    const stmt = db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(token, userId, expiresAt, now);
    return { token, userId, expiresAt };
  },

  findSession(token) {
    const stmt = db.prepare(`
      SELECT s.token, s.user_id, s.expires_at, u.id, u.email, u.name, u.picture
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `);
    return stmt.get(token, Date.now());
  },

  deleteSession(token) {
    const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
  },

  deleteUserSessions(userId) {
    const stmt = db.prepare('DELETE FROM sessions WHERE user_id = ?');
    stmt.run(userId);
  }
};

export const expenseDAO = {
  getAll(userId, { month, category, search, sort = 'date-desc' } = {}) {
    let query = 'SELECT * FROM expenses WHERE user_id = ?';
    const params = [userId];

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query += ' AND month_key = ?';
      params.push(month);
    }

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search && search.trim()) {
      query += ' AND (LOWER(item) LIKE ? OR LOWER(notes) LIKE ?)';
      const term = `%${search.toLowerCase().trim()}%`;
      params.push(term, term);
    }

    // Sort mapping
    const sortClauses = {
      'date-desc': ' ORDER BY date DESC, created_at DESC',
      'date-asc': ' ORDER BY date ASC, created_at ASC',
      'amount-desc': ' ORDER BY amount DESC, date DESC',
      'amount-asc': ' ORDER BY amount ASC, date ASC'
    };
    query += sortClauses[sort] || sortClauses['date-desc'];

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(r => ({
      id: r.id,
      date: r.date,
      monthKey: r.month_key,
      item: r.item,
      amount: r.amount,
      category: r.category,
      paymentMethod: r.payment_method,
      notes: r.notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  getById(userId, id) {
    const stmt = db.prepare('SELECT * FROM expenses WHERE user_id = ? AND id = ?');
    const r = stmt.get(userId, id);
    if (!r) return null;
    return {
      id: r.id,
      date: r.date,
      monthKey: r.month_key,
      item: r.item,
      amount: r.amount,
      category: r.category,
      paymentMethod: r.payment_method,
      notes: r.notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  create(userId, data) {
    const now = Date.now();
    const id = data.id || ('exp_' + now + '_' + Math.random().toString(36).substring(2, 7));
    const date = data.date || new Date().toISOString().split('T')[0];
    const monthKey = data.monthKey || date.substring(0, 7);
    const amount = Math.round(parseFloat(data.amount) * 100) / 100;

    const stmt = db.prepare(`
      INSERT INTO expenses (id, user_id, date, month_key, item, amount, category, payment_method, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      date,
      monthKey,
      data.item.trim(),
      amount,
      data.category || 'Food',
      data.paymentMethod || 'UPI',
      (data.notes || '').trim(),
      now,
      now
    );

    return this.getById(userId, id);
  },

  update(userId, id, data) {
    const existing = this.getById(userId, id);
    if (!existing) return null;

    const now = Date.now();
    const date = data.date || existing.date;
    const monthKey = date.substring(0, 7);
    const amount = data.amount !== undefined ? Math.round(parseFloat(data.amount) * 100) / 100 : existing.amount;
    const item = data.item ? data.item.trim() : existing.item;
    const category = data.category || existing.category;
    const paymentMethod = data.paymentMethod || existing.paymentMethod;
    const notes = data.notes !== undefined ? (data.notes || '').trim() : existing.notes;

    const stmt = db.prepare(`
      UPDATE expenses
      SET date = ?, month_key = ?, item = ?, amount = ?, category = ?, payment_method = ?, notes = ?, updated_at = ?
      WHERE user_id = ? AND id = ?
    `);

    stmt.run(date, monthKey, item, amount, category, paymentMethod, notes, now, userId, id);
    return this.getById(userId, id);
  },

  delete(userId, id) {
    const stmt = db.prepare('DELETE FROM expenses WHERE user_id = ? AND id = ?');
    const res = stmt.run(userId, id);
    return res.changes > 0;
  },

  deleteMonth(userId, monthKey) {
    const stmt = db.prepare('DELETE FROM expenses WHERE user_id = ? AND month_key = ?');
    const res = stmt.run(userId, monthKey);
    return res.changes;
  },

  deleteAll(userId) {
    const stmt = db.prepare('DELETE FROM expenses WHERE user_id = ?');
    const res = stmt.run(userId);
    return res.changes;
  },

  bulkSync(userId, expensesList) {
    if (!Array.isArray(expensesList) || expensesList.length === 0) {
      return 0;
    }

    let insertedOrUpdated = 0;
    const now = Date.now();

    const insertStmt = db.prepare(`
      INSERT INTO expenses (id, user_id, date, month_key, item, amount, category, payment_method, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        month_key = excluded.month_key,
        item = excluded.item,
        amount = excluded.amount,
        category = excluded.category,
        payment_method = excluded.payment_method,
        notes = excluded.notes,
        updated_at = excluded.updated_at
      WHERE expenses.user_id = excluded.user_id
    `);

    for (const exp of expensesList) {
      if (!exp.item || !exp.amount) continue;
      const id = exp.id || ('exp_' + now + '_' + Math.random().toString(36).substring(2, 7));
      const date = exp.date || new Date().toISOString().split('T')[0];
      const monthKey = exp.monthKey || date.substring(0, 7);
      const amount = Math.round(parseFloat(exp.amount) * 100) / 100;

      insertStmt.run(
        id,
        userId,
        date,
        monthKey,
        exp.item.trim(),
        amount,
        exp.category || 'Food',
        exp.paymentMethod || 'UPI',
        (exp.notes || '').trim(),
        exp.createdAt || now,
        now
      );
      insertedOrUpdated++;
    }

    return insertedOrUpdated;
  },

  getDistinctMonths(userId) {
    const stmt = db.prepare('SELECT DISTINCT month_key FROM expenses WHERE user_id = ? ORDER BY month_key DESC');
    return stmt.all(userId).map(r => r.month_key);
  }
};

export const budgetDAO = {
  getAll(userId) {
    const stmt = db.prepare('SELECT month_key, amount FROM budgets WHERE user_id = ?');
    const rows = stmt.all(userId);
    const budgets = {};
    rows.forEach(r => {
      budgets[r.month_key] = r.amount;
    });
    return budgets;
  },

  getForMonth(userId, monthKey) {
    const stmt = db.prepare('SELECT amount FROM budgets WHERE user_id = ? AND month_key = ?');
    const row = stmt.get(userId, monthKey);
    return row ? row.amount : 25000;
  },

  upsert(userId, monthKey, amount) {
    const stmt = db.prepare(`
      INSERT INTO budgets (user_id, month_key, amount, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, month_key) DO UPDATE SET
        amount = excluded.amount,
        updated_at = excluded.updated_at
    `);
    const val = Math.round(parseFloat(amount));
    stmt.run(userId, monthKey, val, Date.now());
    return { monthKey, amount: val };
  }
};

export const budgetAlertDAO = {
  hasAlertBeenSent(userId, monthKey, threshold, allowSimulated = false) {
    if (allowSimulated) {
      const stmt = db.prepare('SELECT id FROM budget_alerts WHERE user_id = ? AND month_key = ? AND threshold = ?');
      const res = stmt.get(userId, monthKey, threshold);
      return Boolean(res);
    }
    // Only return true if a REAL email was sent (is_simulated = 0 or is_simulated IS NULL)
    const stmt = db.prepare('SELECT id FROM budget_alerts WHERE user_id = ? AND month_key = ? AND threshold = ? AND (is_simulated = 0 OR is_simulated IS NULL)');
    const res = stmt.get(userId, monthKey, threshold);
    return Boolean(res);
  },

  recordAlert({ userId, monthKey, threshold, spentAmount, budgetAmount, recipientEmail, isSimulated = 0 }) {
    const id = 'alt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const stmt = db.prepare(`
      INSERT INTO budget_alerts (id, user_id, month_key, threshold, sent_at, spent_amount, budget_amount, recipient_email, is_simulated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, month_key, threshold) DO UPDATE SET
        sent_at = excluded.sent_at,
        spent_amount = excluded.spent_amount,
        budget_amount = excluded.budget_amount,
        recipient_email = excluded.recipient_email,
        is_simulated = excluded.is_simulated
    `);
    stmt.run(id, userId, monthKey, threshold, Date.now(), spentAmount, budgetAmount, recipientEmail, isSimulated ? 1 : 0);
    return id;
  },

  getAlertsForMonth(userId, monthKey) {
    const stmt = db.prepare('SELECT * FROM budget_alerts WHERE user_id = ? AND month_key = ? ORDER BY threshold ASC');
    const rows = stmt.all(userId, monthKey);
    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      monthKey: r.month_key,
      threshold: r.threshold,
      sentAt: r.sent_at,
      spentAmount: r.spent_amount,
      budgetAmount: r.budget_amount,
      recipientEmail: r.recipient_email,
      isSimulated: Boolean(r.is_simulated)
    }));
  },

  resetAlertsForMonth(userId, monthKey) {
    const stmt = db.prepare('DELETE FROM budget_alerts WHERE user_id = ? AND month_key = ?');
    stmt.run(userId, monthKey);
  },

  clearSimulatedAlerts(userId) {
    const stmt = db.prepare('DELETE FROM budget_alerts WHERE user_id = ? AND is_simulated = 1');
    return stmt.run(userId);
  }
};

export default db;
