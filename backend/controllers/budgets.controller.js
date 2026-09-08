/**
 * budgets.controller.js - Monthly Budgets Controller & Alert Triggers
 */

import { budgetDAO, budgetAlertDAO } from '../db/db.js';
import {
  checkAndTriggerBudgetAlerts,
  sendTestEmail,
  isGmailConfigured,
  getGmailConfigStatus,
  verifyAndSaveGmailCredentials
} from '../services/mail.service.js';

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

  getMailStatus(req, res) {
    const status = getGmailConfigStatus();
    res.json({
      ...status,
      userEmail: req.user?.email || ''
    });
  },

  async configureMail(req, res) {
    const { gmailUser, gmailAppPassword, sendTestNow = true } = req.body || {};

    try {
      // 1. Verify connection and save credentials to .env
      const result = await verifyAndSaveGmailCredentials(gmailUser, gmailAppPassword);

      // 2. Clear previous simulated alerts for this user so real emails can fire
      budgetAlertDAO.clearSimulatedAlerts(req.user.id);

      // 3. Optionally dispatch test email immediately
      let testEmailResult = null;
      if (sendTestNow) {
        testEmailResult = await sendTestEmail({
          toEmail: req.user.email,
          userName: req.user.name
        });
      }

      // 4. Automatically check & trigger real alerts for current month and previous month
      const currentMonthKey = new Date().toISOString().substring(0, 7);
      const prevDate = new Date();
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevMonthKey = prevDate.toISOString().substring(0, 7);

      const alertResults = [];
      const resCurrent = await checkAndTriggerBudgetAlerts(req.user.id, currentMonthKey, req.user.email, req.user.name);
      if (resCurrent.alertsTriggered?.length) alertResults.push(...resCurrent.alertsTriggered);

      const resPrev = await checkAndTriggerBudgetAlerts(req.user.id, prevMonthKey, req.user.email, req.user.name);
      if (resPrev.alertsTriggered?.length) alertResults.push(...resPrev.alertsTriggered);

      res.json({
        success: true,
        message: 'Gmail SMTP configured and connected successfully!',
        testEmail: testEmailResult,
        alertsTriggered: alertResults
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },

  async checkAlerts(req, res) {
    const { monthKey } = req.body || {};
    const targetMonth = monthKey || new Date().toISOString().substring(0, 7);
    try {
      const result = await checkAndTriggerBudgetAlerts(
        req.user.id,
        targetMonth,
        req.user.email,
        req.user.name
      );
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
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
