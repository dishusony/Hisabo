/**
 * profile.controller.js - Profile & Settings Controller
 */

import { profileDAO, sessionDAO } from '../db/db.js';

export const profileController = {
  getProfile(req, res) {
    const profile = profileDAO.getProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    res.json({ profile });
  },

  updateProfile(req, res) {
    const { name, phone, picture } = req.body || {};
    const updated = profileDAO.updateProfile(req.user.id, { name, phone, picture });
    res.json({ success: true, profile: updated });
  },

  getSettings(req, res) {
    const settings = profileDAO.getSettings(req.user.id);
    res.json({ settings });
  },

  updateSettings(req, res) {
    const updated = profileDAO.updateSettings(req.user.id, req.body || {});
    res.json({ success: true, settings: updated });
  },

  deleteAccount(req, res) {
    const { confirmText } = req.body || {};
    if (confirmText !== 'DELETE') {
      return res.status(400).json({ error: 'Please confirm account deletion by submitting "DELETE".' });
    }

    if (req.token) {
      sessionDAO.deleteSession(req.token);
    }
    const deleted = profileDAO.deleteAccount(req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Account not found or could not be deleted' });
    }

    res.json({ success: true, message: 'Account and all financial data have been permanently wiped.' });
  }
};
