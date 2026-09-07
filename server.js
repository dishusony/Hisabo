// ==============================================================================
// Hisabo - Secure Local & Production Node.js Server
// Ensures that environment secrets (.env) are NEVER exposed or leaked to client browsers.
// ==============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Securely load .env file into process.env strictly on the server side
const envPath = path.join(__dirname, '.env');
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

// MIME types for permitted public static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Explicit blacklist of protected server/secret files that must NEVER be served to the browser
const FORBIDDEN_PATTERNS = [
  /^\/\.env/i,          // .env, .env.local, .env.production, etc.
  /^\/\.git/i,          // .git internal metadata
  /^\/\.gitignore/i,    // gitignore
  /^\/package.*\.json/i,// package.json, package-lock.json
  /^\/server\.js/i,     // server source code
  /^\/secrets\//i,      // any private secrets folder
  /\.pem$/i,            // certificates and private keys
  /\.key$/i,
  /\.token$/i,
  /\.log$/i             // server logs
];

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Security Headers applied to every response
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 1. Safe Public Health API (NEVER returns any secret keys or tokens)
  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'active',
      app: 'Hisabo',
      env: process.env.APP_ENV || 'production',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 2. Strict Security Check: Block all requests attempting to access .env or sensitive files
  const isForbidden = FORBIDDEN_PATTERNS.some((pattern) => pattern.test(pathname)) ||
                      pathname.includes('..') || // prevent directory traversal
                      pathname.split('/').some(segment => segment.startsWith('.') && segment !== '.' && segment !== '..'); // block any dotfile

  if (isForbidden) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Access to protected configuration or secret files is strictly denied.');
    return;
  }

  // 3. Map default root to index.html
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(path.join(__dirname, pathname));

  // Ensure file resides within the application root directory
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(` ✨ Hisabo Server Running at http://localhost:${PORT}`);
  console.log(` 🔒 Security: .env & secrets are strictly protected`);
  console.log(`====================================================`);
});
