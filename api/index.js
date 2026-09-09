/**
 * api/index.js - Vercel Serverless Function Handler
 * Forwards incoming HTTP requests to Express app.
 */

import { app } from '../server.js';

export default function handler(req, res) {
  return app(req, res);
}
