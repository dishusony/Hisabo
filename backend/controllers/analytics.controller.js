/**
 * analytics.controller.js - Spending Analytics & Trends Controller
 */

import { expenseDAO, budgetDAO } from '../db/db.js';

export const analyticsController = {
  getKPIs(req, res) {
    const monthKey = req.query.month || new Date().toISOString().substring(0, 7);
    const expenses = expenseDAO.getAll(req.user.id, { month: monthKey });
    const budget = budgetDAO.getForMonth(req.user.id, monthKey);

    let totalSpent = 0;
    let highestExpense = { amount: 0, item: 'None' };
    const categoryBreakdown = {};
    const paymentBreakdown = {};

    expenses.forEach(e => {
      totalSpent += e.amount;
      if (e.amount > highestExpense.amount) {
        highestExpense = { amount: e.amount, item: e.item };
      }
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
      paymentBreakdown[e.paymentMethod] = (paymentBreakdown[e.paymentMethod] || 0) + e.amount;
    });

    totalSpent = Math.round(totalSpent * 100) / 100;
    const remaining = Math.round((budget - totalSpent) * 100) / 100;
    const isOverBudget = totalSpent > budget;
    const percentageUsed = budget > 0 ? Math.min(Math.round((totalSpent / budget) * 100), 100) : 100;
    const transactionCount = expenses.length;
    const averageExpense = transactionCount > 0 ? Math.round((totalSpent / transactionCount) * 100) / 100 : 0;

    res.json({
      monthKey,
      totalSpent,
      budget,
      remaining,
      isOverBudget,
      percentageUsed,
      transactionCount,
      averageExpense,
      highestExpense,
      categoryBreakdown,
      paymentBreakdown
    });
  }
};
