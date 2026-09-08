/**
 * auth.controller.js - Authentication Controller
 * Enforces strict real Gmail addresses (@gmail.com / @googlemail.com) and compulsory Full Name.
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
 * Validates compulsory Full Name:
 * - Must be a string with trimmed length between 2 and 70 characters
 * - Must contain at least one valid alphabetical letter (rejects pure numbers or symbols)
 */
export function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 70) return false;
  // Disallow purely symbols or numbers
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) return false;
  return true;
}

/**
 * Strict RFC 5322 & domain structure email validation
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

  // TLD must be alphabetical and at least 2 characters
  const tld = domainLabels[domainLabels.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) return false;

  return true;
}

/**
 * Strict Real Gmail Validation:
 * - Must be a valid email
 * - Domain must be strictly 'gmail.com' or 'googlemail.com'
 * - Username length must be 6 to 30 characters
 * - Only alphanumeric characters and dots in local part
 */
export function isValidGmail(email) {
  if (!isValidEmail(email)) return false;

  const clean = email.trim().toLowerCase();
  const parts = clean.split('@');
  if (parts.length !== 2) return false;

  const [localPart, domainPart] = parts;

  // Strict domain check
  if (domainPart !== 'gmail.com' && domainPart !== 'googlemail.com') {
    return false;
  }

  // Gmail local part rules
  if (!/^[a-z0-9.]+$/.test(localPart)) {
    return false;
  }

  const alphanumericOnly = localPart.replace(/\./g, '');
  if (alphanumericOnly.length < 6 || alphanumericOnly.length > 30) {
    return false;
  }

  return true;
}

export const authController = {
  getConfig(req, res) {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
  },

  login(req, res) {
    const { email, name, picture, credential, mode = 'login' } = req.body || {};

    let userProfile = null;

    if (credential) {
      const payload = decodeGoogleJwt(credential);
      if (!payload || !payload.email || !isValidGmail(payload.email)) {
        return res.status(400).json({ error: 'Only valid real Gmail accounts (@gmail.com) can sign in to Hisabo.' });
      }

      const extractedName = (payload.name || payload.given_name || name || '').trim();
      if (!isValidName(extractedName)) {
        return res.status(400).json({ error: 'Full Name is compulsory (minimum 2 characters).' });
      }

      userProfile = {
        id: payload.sub || ('g_' + Date.now()),
        email: payload.email.toLowerCase().trim(),
        name: extractedName,
        picture: payload.picture || '',
        provider: 'google'
      };
    } else if (email) {
      // 1. Compulsory Name validation
      const displayName = (name || '').trim();
      if (!isValidName(displayName)) {
        return res.status(400).json({
          error: 'Full Name is compulsory (minimum 2 characters).'
        });
      }

      // 2. Strict Real Gmail validation
      const cleanEmail = email.trim().toLowerCase();
      if (!isValidGmail(cleanEmail)) {
        return res.status(400).json({
          error: 'Only valid real Gmail addresses (@gmail.com) are allowed to enter Hisabo.'
        });
      }

      userProfile = {
        id: 'user_' + crypto.createHash('md5').update(cleanEmail).digest('hex').substring(0, 12),
        email: cleanEmail,
        name: displayName,
        picture: picture || '',
        provider: 'google'
      };
    } else {
      return res.status(400).json({
        error: 'Both Full Name and a valid Gmail address (@gmail.com) are compulsory to enter Hisabo.'
      });
    }

    const existingUser = userDAO.findByEmail(userProfile.email);

    // Upsert user in database
    const user = userDAO.upsertUser(userProfile);

    // Generate secure session token
    const token = crypto.randomBytes(32).toString('hex');
    sessionDAO.createSession(token, user.id);

    res.json({
      token,
      mode,
      isNewUser: !existingUser,
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
