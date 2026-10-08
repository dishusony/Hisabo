/**
 * income.controller.js - CRUD Controller for User Income
 */

import { incomeDAO } from '../db/db.js';

export const incomeController = {
  getAll(req, res) {
    const { month, source, search, sort } = req.query;
    const income = incomeDAO.getAll(req.user.id, { month, source, search, sort });
    res.json({ income, count: income.length });
  },

  getById(req, res) {
    const item = incomeDAO.getById(req.user.id, req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Income entry not found' });
    }
    res.json({ income: item });
  },

  create(req, res) {
    const { source, amount, date, paymentMethod, notes, id } = req.body || {};

    if (!source || !source.trim()) {
      return res.status(400).json({ error: 'Income source is required (e.g. Salary, Freelance)' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Income amount must be a positive number' });
    }

    const newIncome = incomeDAO.create(req.user.id, {
      id,
      source: source.trim(),
      amount: numAmount,
      date,
      paymentMethod,
      notes
    });

    res.status(201).json({ income: newIncome });
  },

  update(req, res) {
    const { source, amount, date, paymentMethod, notes } = req.body || {};

    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Income amount must be a positive number' });
      }
    }

    const updated = incomeDAO.update(req.user.id, req.params.id, {
      source,
      amount,
      date,
      paymentMethod,
      notes
    });

    if (!updated) {
      return res.status(404).json({ error: 'Income entry not found or access denied' });
    }

    res.json({ income: updated });
  },

  delete(req, res) {
    const deleted = incomeDAO.delete(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Income entry not found or access denied' });
    }
    res.json({ success: true, message: 'Income entry deleted successfully' });
  },

  deleteMonth(req, res) {
    const monthKey = req.params.monthKey;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({ error: 'Invalid month format, expected YYYY-MM' });
    }
    const count = incomeDAO.deleteMonth(req.user.id, monthKey);
    res.json({ success: true, deletedCount: count });
  },

  deleteAll(req, res) {
    const count = incomeDAO.deleteAll(req.user.id);
    res.json({ success: true, deletedCount: count });
  }
};
