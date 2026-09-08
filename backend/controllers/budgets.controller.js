/**
 * budgets.controller.js - Monthly Budgets Controller & Alert Triggers
 */

import { budgetDAO, budgetAlertDAO } from '../db/db.js';
import { checkAndTriggerBudgetAlerts, sendTestEmail, isGmailConfigured } from '../services/mail.service.js';

export const budgetsController = {
  getAll(req, res) {
    const budgets = budgetDAO.getAll(req.user.id);
    res.json({ budgets });
  },

  getForMonth(req, res) {
    const { monthKey } = req.params;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({ error: 'Invalid monthKey format, expected YYYY-MM' });
    }
    const amount = budgetDAO.getForMonth(req.user.id, monthKey);
    res.json({ monthKey, amount });
  },

  async setBudget(req, res) {
    const { monthKey } = req.params;
    const { amount } = req.body || {};

    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({ error: 'Invalid monthKey format, expected YYYY-MM' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'Budget amount must be a non-negative number' });
    }

    const result = budgetDAO.upsert(req.user.id, monthKey, numAmount);

    // When budget changes (especially downwards), evaluate if spending crosses thresholds
    let alertInfo = null;
    try {
      alertInfo = await checkAndTriggerBudgetAlerts(
        req.user.id,
        monthKey,
        req.user.email,
        req.user.name
      );
    } catch (err) {
      console.error('[Hisabo Alerts] Error checking budget alerts on setBudget:', err.message);
    }

    res.json({ success: true, ...result, alertInfo });
  },

  getAlerts(req, res) {
    const { monthKey } = req.params;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({ error: 'Invalid monthKey format, expected YYYY-MM' });
    }

    const alerts = budgetAlertDAO.getAlertsForMonth(req.user.id, monthKey);
    res.json({
      monthKey,
      alerts,
      isGmailConfigured: isGmailConfigured()
    });
  },

  async sendTestEmail(req, res) {
    try {
      const result = await sendTestEmail({
        toEmail: req.user.email,
        userName: req.user.name
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
};
