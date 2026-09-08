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
      if (!payload || !payload.email) {
        return res.status(400).json({ error: 'Invalid Google credential token' });
      }
      userProfile = {
        id: payload.sub || ('g_' + Date.now()),
        email: payload.email,
        name: payload.name || payload.given_name || payload.email.split('@')[0],
        picture: payload.picture || '',
        provider: 'google'
      };
    } else if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please provide a valid email address' });
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
      return res.status(400).json({ error: 'Email or Google credential is required' });
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
