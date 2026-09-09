/**
 * api/index.js - Vercel Serverless Function Handler with Diagnostic Reporting
 */

export default async function handler(req, res) {
  try {
    const { app } = await import('../server.js');
    return app(req, res);
  } catch (err) {
    console.error('[Vercel Serverless Error]:', err);
    return res.status(500).json({
      error: 'Serverless initialization error',
      message: err?.message,
      stack: err?.stack,
      nodeVersion: process.version
    });
  }
}
