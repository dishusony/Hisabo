/**
 * budgets.controller.js - Monthly Budgets Controller
 */

import { budgetDAO } from '../db/db.js';

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

  setBudget(req, res) {
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
    res.json({ success: true, ...result });
  }
};
