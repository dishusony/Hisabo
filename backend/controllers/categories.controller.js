/**
 * categories.controller.js - Categories Controller
 */

import { categoryDAO } from '../db/db.js';

export const categoriesController = {
  getAll(req, res) {
    const categories = categoryDAO.getAll(req.user.id);
    res.json({ categories });
  },

  create(req, res) {
    const { name, label, icon, color, bg } = req.body || {};
    const catName = (name || label || '').trim();

    if (!catName) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const newCategory = categoryDAO.create(req.user.id, {
      name: catName,
      icon,
      color,
      bg
    });

    res.status(201).json({ category: { ...newCategory, label: newCategory.name } });
  },

  update(req, res) {
    const { name, label, icon, color, bg } = req.body || {};
    const catName = (name || label || '').trim();

    const updated = categoryDAO.update(req.user.id, req.params.id, {
      name: catName || undefined,
      icon,
      color,
      bg
    });

    if (!updated) {
      return res.status(404).json({ error: 'Category not found or cannot be modified' });
    }

    res.json({ category: { ...updated, label: updated.name } });
  },

  delete(req, res) {
    const { id } = req.params;
    const { force = false } = req.query;

    const all = categoryDAO.getAll(req.user.id);
    const target = all.find(c => c.id === id);

    if (!target) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (target.isDefault) {
      return res.status(400).json({ error: 'Default categories cannot be deleted' });
    }

    const inUse = categoryDAO.hasExpenses(req.user.id, target.name);
    if (inUse && force !== 'true' && force !== true) {
      return res.status(409).json({
        error: `Category "${target.name}" has recorded transactions. Please reassign or delete transactions first.`,
        hasTransactions: true
      });
    }

    const deleted = categoryDAO.delete(req.user.id, id);
    if (!deleted) {
      return res.status(404).json({ error: 'Failed to delete category' });
    }

    res.json({ success: true, message: 'Category deleted successfully' });
  }
};
