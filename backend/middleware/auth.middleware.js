/**
 * auth.middleware.js - Session & Bearer Token Authentication Middleware
 * Supports both secure HTTP-only cookies ('hisabo_session') and Authorization Bearer headers.
 */

import { sessionDAO } from '../db/db.js';

function extractToken(req) {
  // 1. Prefer HTTP-only session cookie if available
  if (req.cookies && req.cookies.hisabo_session) {
    return req.cookies.hisabo_session.trim();
  }

  // 2. Fall back to Authorization Bearer header
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or invalid authentication token. Please sign in.'
    });
  }

  const session = sessionDAO.findSession(token);
  if (!session) {
    return res.status(401).json({
      error: 'Unauthorized: Session has expired or is invalid. Please sign in again.'
    });
  }

  req.user = {
    id: session.id,
    email: session.email,
    name: session.name,
    picture: session.picture || '',
    provider: session.provider || 'email',
    googleId: session.google_id || null,
    isVerified: Boolean(session.is_verified)
  };
  req.token = token;

  next();
}

export function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (token) {
    const session = sessionDAO.findSession(token);
    if (session) {
      req.user = {
        id: session.id,
        email: session.email,
        name: session.name,
        picture: session.picture || '',
        provider: session.provider || 'email',
        googleId: session.google_id || null,
        isVerified: Boolean(session.is_verified)
      };
      req.token = token;
    }
  }

  next();
}
