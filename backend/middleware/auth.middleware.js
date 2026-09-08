/**
 * auth.middleware.js - Session & Bearer Token Authentication Middleware
 */

import { sessionDAO } from '../db/db.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

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
    picture: session.picture
  };
  req.token = token;

  next();
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (token) {
    const session = sessionDAO.findSession(token);
    if (session) {
      req.user = {
        id: session.id,
        email: session.email,
        name: session.name,
        picture: session.picture
      };
      req.token = token;
    }
  }

  next();
}
