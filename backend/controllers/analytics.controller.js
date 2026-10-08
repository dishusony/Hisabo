/**
 * analytics.controller.js - Comprehensive Spending Analytics, Trends & Insights Controller
 */

import { expenseDAO, budgetDAO, incomeDAO } from '../db/db.js';

export const analyticsController = {
  getKPIs(req, res) {
    const monthKey = req.query.month || new Date().toISOString().substring(0, 7);

    // Compute previous month key (e.g. 2026-09 -> 2026-08)
    const [yearStr, monthStr] = monthKey.split('-');
    const currentYear = parseInt(yearStr, 10);
    const currentMonthNum = parseInt(monthStr, 10);
    const prevDate = new Date(Date.UTC(currentYear, currentMonthNum - 2, 1));
    const prevMonthKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

    // Get current month data
    const expenses = expenseDAO.getAll(req.user.id, { month: monthKey });
    const incomeItems = incomeDAO.getAll(req.user.id, { month: monthKey });
    const budget = budgetDAO.getForMonth(req.user.id, monthKey);
    const categoryBudgets = budgetDAO.getCategoryBudgets(req.user.id, monthKey);

    // Get previous month data for trends
    const prevExpenses = expenseDAO.getAll(req.user.id, { month: prevMonthKey });
    const prevIncomeItems = incomeDAO.getAll(req.user.id, { month: prevMonthKey });

    // Calculate totals
    let totalSpent = 0;
    let highestExpense = { amount: 0, item: 'None', date: '' };
    const categoryBreakdown = {};
    const paymentBreakdown = {};
    const dailyExpenses = {};

    expenses.forEach(e => {
      totalSpent += e.amount;
      if (e.amount > highestExpense.amount) {
        highestExpense = { amount: e.amount, item: e.item, date: e.date };
      }
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
      paymentBreakdown[e.paymentMethod] = (paymentBreakdown[e.paymentMethod] || 0) + e.amount;
      dailyExpenses[e.date] = (dailyExpenses[e.date] || 0) + e.amount;
    });

    let totalIncome = 0;
    incomeItems.forEach(i => {
      totalIncome += i.amount;
    });

    let prevTotalSpent = 0;
    prevExpenses.forEach(e => {
      prevTotalSpent += e.amount;
    });

    let prevTotalIncome = 0;
    prevIncomeItems.forEach(i => {
      prevTotalIncome += i.amount;
    });

    totalSpent = Math.round(totalSpent * 100) / 100;
    totalIncome = Math.round(totalIncome * 100) / 100;
    prevTotalSpent = Math.round(prevTotalSpent * 100) / 100;
    prevTotalIncome = Math.round(prevTotalIncome * 100) / 100;

    const balance = Math.round((totalIncome - totalSpent) * 100) / 100;
    const prevBalance = Math.round((prevTotalIncome - prevTotalSpent) * 100) / 100;

    // Percentage changes
    const calcPct = (curr, prev) => {
      if (!prev || prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const expenseChangePercent = calcPct(totalSpent, prevTotalSpent);
    const incomeChangePercent = calcPct(totalIncome, prevTotalIncome);
    const balanceChangePercent = calcPct(balance, prevBalance);

    // Highest spending day
    let highestSpendingDay = { date: 'None', amount: 0 };
    for (const [date, amt] of Object.entries(dailyExpenses)) {
      if (amt > highestSpendingDay.amount) {
        highestSpendingDay = { date, amount: Math.round(amt * 100) / 100 };
      }
    }

    // Top categories ranking
    const topCategories = Object.entries(categoryBreakdown)
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount * 100) / 100,
        percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Days in current month for average daily spending
    const daysInMonth = new Date(currentYear, currentMonthNum, 0).getDate();
    const averageDailyExpense = Math.round((totalSpent / daysInMonth) * 100) / 100;

    const remaining = Math.round((budget - totalSpent) * 100) / 100;
    const isOverBudget = totalSpent > budget;
    const percentageUsed = budget > 0 ? Math.min(Math.round((totalSpent / budget) * 100), 100) : 100;
    const transactionCount = expenses.length;
    const averageExpense = transactionCount > 0 ? Math.round((totalSpent / transactionCount) * 100) / 100 : 0;

    // Daily trend array sorted by date
    const dailyTrend = Object.entries(dailyExpenses)
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Dynamic spending insights generated strictly from real data
    const spendingInsights = [];

    if (totalSpent > 0 && topCategories.length > 0) {
      const top = topCategories[0];
      spendingInsights.push(`Your highest spending category is ${top.name}, accounting for ${top.percentage}% of total expenses (₹${top.amount.toLocaleString('en-IN')}).`);
    }

    if (topCategories.length > 1) {
      const second = topCategories[1];
      spendingInsights.push(`${second.name} is your second-highest expense category at ₹${second.amount.toLocaleString('en-IN')} (${second.percentage}%).`);
    }

    if (prevTotalSpent > 0 && totalSpent > 0) {
      if (expenseChangePercent > 0) {
        spendingInsights.push(`You have spent ${expenseChangePercent}% more this month compared to the previous period.`);
      } else if (expenseChangePercent < 0) {
        spendingInsights.push(`Great discipline! You have spent ${Math.abs(expenseChangePercent)}% less this month compared to last month.`);
      } else {
        spendingInsights.push(`Your spending is identical to the previous month's expenditure.`);
      }
    }

    if (totalIncome > 0) {
      const savingsRate = Math.round((Math.max(0, balance) / totalIncome) * 100);
      spendingInsights.push(`Your current savings rate is ${savingsRate}% (Net savings: ₹${Math.max(0, balance).toLocaleString('en-IN')}).`);
    }

    if (totalSpent > 0) {
      spendingInsights.push(`Your average daily expenditure for ${monthKey} is ₹${averageDailyExpense.toLocaleString('en-IN')}.`);
    }

    if (spendingInsights.length === 0) {
      spendingInsights.push('Add your initial expenses and income to unlock personalized financial insights.');
    }

    res.json({
      monthKey,
      totalIncome,
      totalSpent,
      balance,
      prevTotalIncome,
      prevTotalSpent,
      prevBalance,
      incomeChangePercent,
      expenseChangePercent,
      balanceChangePercent,
      budget,
      remaining,
      isOverBudget,
      percentageUsed,
      categoryBudgets,
      transactionCount,
      averageExpense,
      averageDailyExpense,
      highestExpense,
      highestSpendingDay,
      categoryBreakdown,
      paymentBreakdown,
      topCategories,
      dailyTrend,
      spendingInsights
    });
  }
};
