/**
 * auth.controller.js - Authentication Controller
 */

import crypto from 'node:crypto';
import { userDAO, sessionDAO } from '../db/db.js';

function decodeGoogleJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * Strict RFC 5322 & domain structure email validation
 * Rejects malformed addresses, consecutive dots, missing or invalid TLDs, and spaces.
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim();
  if (clean.length > 254 || clean.length < 5) return false;

  // Disallow any whitespace
  if (/\s/.test(clean)) return false;

  // Single @ symbol separating local and domain parts
  const parts = clean.split('@');
  if (parts.length !== 2) return false;

  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart) return false;
  if (localPart.length > 64) return false;

  // Local part rules: no leading/trailing dot, no consecutive dots
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false;
  }
  const localRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  if (!localRegex.test(localPart)) return false;

  // Domain part rules: no leading/trailing dot, no consecutive dots
  if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
    return false;
  }
  const domainLabels = domainPart.split('.');
  if (domainLabels.length < 2) return false;

  for (const label of domainLabels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
  }

  // TLD (last label) must be alphabetical and at least 2 characters
  const tld = domainLabels[domainLabels.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) return false;

  return true;
}

export const authController = {
  getConfig(req, res) {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
  },

  login(req, res) {
    const { email, name, picture, credential } = req.body || {};

    let userProfile = null;

    if (credential) {
      const payload = decodeGoogleJwt(credential);
      if (!payload || !payload.email || !isValidEmail(payload.email)) {
        return res.status(400).json({ error: 'Invalid Google credential token or email address' });
      }
      userProfile = {
        id: payload.sub || ('g_' + Date.now()),
        email: payload.email.toLowerCase().trim(),
        name: payload.name || payload.given_name || payload.email.split('@')[0],
        picture: payload.picture || '',
        provider: 'google'
      };
    } else if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({
          error: 'Only valid email addresses are permitted (e.g. name@example.com). Please check your email and try again.'
        });
      }
      const displayName = (name || '').trim() || cleanEmail.split('@')[0];
      userProfile = {
        id: 'user_' + crypto.createHash('md5').update(cleanEmail).digest('hex').substring(0, 12),
        email: cleanEmail,
        name: displayName,
        picture: picture || '',
        provider: 'google'
      };
    } else {
      return res.status(400).json({ error: 'A valid email address is required to enter Hisabo.' });
    }

    // Upsert user in database
    const user = userDAO.upsertUser(userProfile);

    // Generate secure session token
    const token = crypto.randomBytes(32).toString('hex');
    sessionDAO.createSession(token, user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  },

  getMe(req, res) {
    res.json({
      user: req.user
    });
  },

  logout(req, res) {
    if (req.token) {
      sessionDAO.deleteSession(req.token);
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
};
