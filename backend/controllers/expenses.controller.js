/**
 * expenses.controller.js - CRUD & Sync Controller for Expenses
 */

import { expenseDAO } from '../db/db.js';

export const expensesController = {
  getAll(req, res) {
    const { month, category, search, sort } = req.query;
    const expenses = expenseDAO.getAll(req.user.id, { month, category, search, sort });
    res.json({ expenses, count: expenses.length });
  },

  getById(req, res) {
    const expense = expenseDAO.getById(req.user.id, req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json({ expense });
  },

  create(req, res) {
    const { item, amount, date, category, paymentMethod, notes, id } = req.body || {};

    if (!item || !item.trim()) {
      return res.status(400).json({ error: 'Item description is required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const newExpense = expenseDAO.create(req.user.id, {
      id,
      item,
      amount: numAmount,
      date,
      category,
      paymentMethod,
      notes
    });

    res.status(201).json({ expense: newExpense });
  },

  update(req, res) {
    const { item, amount, date, category, paymentMethod, notes } = req.body || {};

    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
    }

    const updated = expenseDAO.update(req.user.id, req.params.id, {
      item,
      amount,
      date,
      category,
      paymentMethod,
      notes
    });

    if (!updated) {
      return res.status(404).json({ error: 'Expense not found or access denied' });
    }

    res.json({ expense: updated });
  },

  delete(req, res) {
    const deleted = expenseDAO.delete(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Expense not found or access denied' });
    }
    res.json({ success: true, message: 'Expense deleted successfully' });
  },

  deleteMonth(req, res) {
    const monthKey = req.params.monthKey;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({ error: 'Invalid month format, expected YYYY-MM' });
    }
    const count = expenseDAO.deleteMonth(req.user.id, monthKey);
    res.json({ success: true, deletedCount: count });
  },

  deleteAll(req, res) {
    const count = expenseDAO.deleteAll(req.user.id);
    res.json({ success: true, deletedCount: count });
  },

  sync(req, res) {
    const { expenses } = req.body || {};
    if (!Array.isArray(expenses)) {
      return res.status(400).json({ error: 'Expected an array of expenses under "expenses"' });
    }

    const syncedCount = expenseDAO.bulkSync(req.user.id, expenses);
    const allUserExpenses = expenseDAO.getAll(req.user.id);

    res.json({
      success: true,
      syncedCount,
      totalExpenses: allUserExpenses.length,
      expenses: allUserExpenses
    });
  },

  getMonths(req, res) {
    const months = expenseDAO.getDistinctMonths(req.user.id);
    res.json({ months });
  }
};
