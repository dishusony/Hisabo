/**
 * goals.controller.js - Financial Goals Controller
 */

import { goalDAO } from '../db/db.js';

export const goalsController = {
  getAll(req, res) {
    const goals = goalDAO.getAll(req.user.id);
    res.json({ goals, count: goals.length });
  },

  getById(req, res) {
    const goal = goalDAO.getById(req.user.id, req.params.id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json({ goal });
  },

  create(req, res) {
    const { name, targetAmount, currentAmount, deadline, category, icon, color } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Goal name is required' });
    }

    const numTarget = parseFloat(targetAmount);
    if (isNaN(numTarget) || numTarget <= 0) {
      return res.status(400).json({ error: 'Target amount must be a positive number' });
    }

    const newGoal = goalDAO.create(req.user.id, {
      name,
      targetAmount: numTarget,
      currentAmount: parseFloat(currentAmount) || 0,
      deadline,
      category,
      icon,
      color
    });

    res.status(201).json({ goal: newGoal });
  },

  update(req, res) {
    const { name, targetAmount, currentAmount, deadline, category, icon, color } = req.body || {};

    if (targetAmount !== undefined) {
      const numTarget = parseFloat(targetAmount);
      if (isNaN(numTarget) || numTarget <= 0) {
        return res.status(400).json({ error: 'Target amount must be a positive number' });
      }
    }

    const updated = goalDAO.update(req.user.id, req.params.id, {
      name,
      targetAmount,
      currentAmount,
      deadline,
      category,
      icon,
      color
    });

    if (!updated) {
      return res.status(404).json({ error: 'Goal not found or access denied' });
    }

    res.json({ goal: updated });
  },

  addFunds(req, res) {
    const { amount } = req.body || {};
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Contribution amount must be a positive number' });
    }

    const updated = goalDAO.addFunds(req.user.id, req.params.id, numAmount);
    if (!updated) {
      return res.status(404).json({ error: 'Goal not found or access denied' });
    }

    res.json({ success: true, goal: updated, addedAmount: numAmount });
  },

  delete(req, res) {
    const deleted = goalDAO.delete(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Goal not found or access denied' });
    }
    res.json({ success: true, message: 'Goal deleted successfully' });
  }
};
