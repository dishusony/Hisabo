// ==============================================================================
// Hisabo - Production Node.js & Express Server
// RESTful Backend APIs, SQLite Persistence, Security & Static Assets
// ==============================================================================

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import Routes & Middleware
import authRoutes from './routes/auth.routes.js';
import expensesRoutes from './routes/expenses.routes.js';
import budgetsRoutes from './routes/budgets.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Securely load .env file into process.env strictly on the server side
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn('[Hisabo Server] Note: Could not parse .env file:', err.message);
  }
}

const PORT = parseInt(process.env.APP_PORT || process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const app = express();

// Security Headers applied to every request
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Explicit blacklist of protected server/secret files that must NEVER be served
const FORBIDDEN_PATTERNS = [
  /^\/\.env/i,          // .env, .env.local, .env.production, etc.
  /^\/\.git/i,          // .git internal metadata
  /^\/\.gitignore/i,    // gitignore
  /^\/package.*\.json/i,// package.json, package-lock.json
  /^\/server\.js/i,     // server source code
  /^\/backend\//i,      // backend source code
  /^\/secrets\//i,      // any private secrets folder
  /\.pem$/i,            // certificates and private keys
  /\.key$/i,
  /\.token$/i,
  /\.sqlite(-.*)?$/i,   // raw database files
  /\.log$/i             // server logs
];

app.use((req, res, next) => {
  const pathname = decodeURIComponent(req.path);
  const isForbidden = FORBIDDEN_PATTERNS.some((pattern) => pattern.test(pathname)) ||
                      pathname.includes('..') ||
                      pathname.split('/').some(segment => segment.startsWith('.') && segment !== '.' && segment !== '..');

  if (isForbidden) {
    return res.status(403).type('text/plain; charset=utf-8').send('403 Forbidden: Access to protected configuration or secret files is strictly denied.');
  }
  next();
});

// Parsers & Cross-Origin
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Safe Public Health API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    app: 'Hisabo',
    env: process.env.APP_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

// Mount Modular REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Static Asset Serving
app.use(express.static(rootDir, {
  dotfiles: 'deny',
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Centralized Error Handler
app.use(errorHandler);

// Start Server when run directly
let server = null;
if (!process.env.VERCEL) {
  server = app.listen(PORT, HOST, () => {
    console.log(`====================================================`);
    console.log(` ✨ Hisabo Express Server Running at http://localhost:${PORT}`);
    console.log(` 🚀 RESTful APIs mounted at /api/*`);
    console.log(` 🔒 Security: .env & backend code are strictly protected`);
    console.log(`====================================================`);
  });
}

export default app;
export { app, server };
