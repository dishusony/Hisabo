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

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'hisabo.sqlite');
const db = new DatabaseSync(dbPath);

// Performance & Integrity settings
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

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
`);

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

  upsertUser({ id, email, name, picture, provider = 'google' }) {
    const cleanEmail = email.toLowerCase().trim();
    const existing = this.findByEmail(cleanEmail);

    if (existing) {
      const stmt = db.prepare(`
        UPDATE users 
        SET name = ?, picture = ?, last_login = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      stmt.run(name || existing.name, picture || existing.picture, existing.id);
      return this.findById(existing.id);
    } else {
      const stmt = db.prepare(`
        INSERT INTO users (id, email, name, picture, provider, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      stmt.run(id, cleanEmail, name, picture, provider);
      return this.findById(id);
    }
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

export default db;
