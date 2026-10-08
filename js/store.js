/**
 * store.js - State Management & Database Persistence
 * Connects directly to the backend SQLite database as the single source of truth for expenses.
 */

import { api } from './api.js';

const STORAGE_KEYS = {
  THEME: 'hisabo_theme_v1',
  SELECTED_MONTH: 'hisabo_selected_month_v1'
};

export const CATEGORIES = [
  { id: 'Food', label: 'Food & Dining', icon: 'utensils', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
  { id: 'Travel', label: 'Travel & Commute', icon: 'car', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.15)' },
  { id: 'Shopping', label: 'Shopping', icon: 'shopping-bag', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  { id: 'Education', label: 'Education & Courses', icon: 'graduation-cap', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  { id: 'Entertainment', label: 'Entertainment & Outings', icon: 'film', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  { id: 'Bills', label: 'Bills & Utilities', icon: 'zap', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  { id: 'Health', label: 'Health & Fitness', icon: 'heart-pulse', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  { id: 'Hostel', label: 'Hostel / Rent', icon: 'home', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  { id: 'Personal', label: 'Personal Care', icon: 'user', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
  { id: 'Other', label: 'Other', icon: 'more-horizontal', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' }
];

export const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash', icon: 'banknote', color: '#10b981' },
  { id: 'UPI', label: 'UPI (GPay / PhonePe / Paytm)', icon: 'smartphone', color: '#6366f1' },
  { id: 'Debit Card', label: 'Debit Card', icon: 'credit-card', color: '#0284c7' },
  { id: 'Credit Card', label: 'Credit Card', icon: 'credit-card', color: '#f59e0b' },
  { id: 'Bank Transfer', label: 'Bank Transfer / NEFT', icon: 'building', color: '#8b5cf6' },
  { id: 'Other', label: 'Other', icon: 'wallet', color: '#64748b' }
];

export const DEFAULT_BUDGET = 5000;

class ExpenseStore {
  constructor() {
    this.expenses = [];
    this.income = [];
    this.budgets = {
      '2026-09': 5000,
      '2026-08': 5000,
      '2026-07': 5000
    };
    this.categoryBudgets = {};
    this.categories = [...CATEGORIES];
    this.goals = [];
    this.profile = null;
    this.settings = {
      currency: 'INR',
      theme: 'midnight',
      expenseAlerts: true,
      budgetAlerts: true,
      weeklyReports: true
    };
    this.currentUser = null;
    this.selectedMonth = this.getInitialMonth();
    this.offlineQueue = this.loadOfflineQueue();
  }

  async init() {
    return this.loadFromDatabase();
  }

  getInitialMonth() {
    if (typeof localStorage === 'undefined') {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
    const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_MONTH);
    if (saved && /^\d{4}-\d{2}$/.test(saved)) {
      return saved;
    }
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  setSelectedMonth(monthKey) {
    if (/^\d{4}-\d{2}$/.test(monthKey)) {
      this.selectedMonth = monthKey;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SELECTED_MONTH, monthKey);
      }
    }
  }

  resetState() {
    this.expenses = [];
    this.income = [];
    this.budgets = {
      '2026-09': 5000,
      '2026-08': 5000,
      '2026-07': 5000
    };
    this.categoryBudgets = {};
    this.categories = [...CATEGORIES];
    this.goals = [];
    this.profile = null;
    this.currentUser = null;
    this.selectedMonth = this.getInitialMonth();
  }

  resetToCurrentMonth() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    this.setSelectedMonth(`${y}-${m}`);
  }

  getSelectedMonth() {
    return this.selectedMonth;
  }

  getBudget(monthKey = this.selectedMonth) {
    if (this.budgets[monthKey] !== undefined) {
      return Number(this.budgets[monthKey]);
    }
    return DEFAULT_BUDGET;
  }

  async setBudget(monthKey, amount) {
    const val = Number(amount);
    if (!isNaN(val) && val >= 0) {
      this.budgets[monthKey] = Math.round(val);
      this.saveLocalFallback();
      if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
        try {
          const res = await api.setBudget(monthKey, Math.round(val));
          if (res?.alertInfo?.alertsTriggered?.length && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hisabo:budget-alerts', { detail: res.alertInfo }));
          }
        } catch (err) {
          console.warn('[Store] Failed to save budget to database:', err.message);
        }
      }
      return true;
    }
    return false;
  }

  async setMonthlyBudget(monthKey, amount) {
    return this.setBudget(monthKey, amount);
  }

  /**
   * Loads the authoritative list of user expenses and budgets from the backend database.
   * Does NOT restore old data from localStorage.
   */
  async loadFromDatabase() {
    if (typeof fetch === 'undefined' || !api?.hasToken || !api.hasToken()) {
      this.loadLocalFallback();
      return false;
    }

    try {
      const [expenses, budgets, income, categoryBudgets, categories, goals, profile, settings] = await Promise.all([
        api.getExpenses().catch(() => []),
        api.getBudgets().catch(() => ({})),
        api.getIncome().catch(() => []),
        api.getCategoryBudgets(this.selectedMonth).catch(() => ({})),
        api.getCategories().catch(() => []),
        api.getGoals().catch(() => []),
        api.getProfile().catch(() => null),
        api.getSettings().catch(() => null)
      ]);

      this.expenses = Array.isArray(expenses)
        ? expenses.map(e => ({
            ...e,
            title: e.title || e.item || 'Expense',
            item: e.item || e.title || 'Expense'
          }))
        : [];
      if (budgets && typeof budgets === 'object') {
        this.budgets = { ...this.budgets, ...budgets };
      }
      this.income = Array.isArray(income) ? income : [];
      if (categoryBudgets && typeof categoryBudgets === 'object') {
        this.categoryBudgets[this.selectedMonth] = categoryBudgets;
      }
      if (Array.isArray(categories) && categories.length > 0) {
        this.categories = categories.map(c => ({
          ...c,
          label: c.label || c.name || c.id,
          name: c.name || c.label || c.id
        }));
      }
      this.goals = Array.isArray(goals) ? goals : [];
      if (profile) this.profile = profile;
      if (settings) this.settings = settings;

      this.saveLocalFallback();
      return true;
    } catch (err) {
      console.warn('[Store] Could not load from database, loading local fallback:', err.message);
      this.loadLocalFallback();
      return false;
    }
  }

  loadOfflineQueue() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const q = localStorage.getItem('hisabo_offline_queue');
      return q ? JSON.parse(q) : [];
    } catch (e) {
      return [];
    }
  }

  saveOfflineQueue() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('hisabo_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (e) {}
  }

  queueOfflineOperation(op, item) {
    if (!this.offlineQueue) this.offlineQueue = [];
    this.offlineQueue.push({ op, item, timestamp: Date.now() });
    this.saveOfflineQueue();
  }

  getOfflineQueueCount() {
    return (this.offlineQueue || []).length;
  }

  async syncOfflineQueue() {
    if (typeof fetch === 'undefined' || !api?.hasToken || !api.hasToken() || !this.offlineQueue || this.offlineQueue.length === 0) {
      return 0;
    }
    let syncedCount = 0;
    const remainingQueue = [];
    for (const entry of this.offlineQueue) {
      try {
        if (entry.op === 'add') {
          const res = await api.createExpense(entry.item);
          if (res && res.id) {
            const idx = this.expenses.findIndex(e => e.id === entry.item.id);
            if (idx !== -1) {
              this.expenses[idx] = { ...this.expenses[idx], ...res };
            }
          }
          syncedCount++;
        } else if (entry.op === 'update') {
          await api.updateExpense(entry.item.id, entry.item);
          syncedCount++;
        } else if (entry.op === 'delete') {
          await api.deleteExpense(entry.item.id);
          syncedCount++;
        }
      } catch (err) {
        remainingQueue.push(entry);
      }
    }
    this.offlineQueue = remainingQueue;
    this.saveOfflineQueue();
    this.saveLocalFallback();
    return syncedCount;
  }

  saveLocalFallback() {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = this.currentUser?.email ? `hisabo_expenses_${this.currentUser.email}` : 'hisabo_expenses_guest';
      localStorage.setItem(key, JSON.stringify(this.expenses));
    } catch (e) {}
  }

  loadLocalFallback() {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = this.currentUser?.email ? `hisabo_expenses_${this.currentUser.email}` : 'hisabo_expenses_guest';
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.expenses = parsed;
        }
      }
    } catch (e) {}
  }

  getAllExpenses() {
    return [...this.expenses];
  }

  getExpensesForMonth(monthKey = this.selectedMonth) {
    return this.expenses.filter(item => {
      const itemMonth = item.date ? item.date.substring(0, 7) : item.monthKey;
      return itemMonth === monthKey;
    });
  }

  getMonthExpenses(monthKey = this.selectedMonth) {
    return this.getExpensesForMonth(monthKey);
  }

  getExpenseById(id) {
    return this.expenses.find(item => item.id === id) || null;
  }

  /**
   * Adds an expense to the backend database and updates state.
   * Resilient to network outages: saves locally, queues for auto-retry when connection returns,
   * and provides synchronous property access and Promise resolution.
   */
  addExpense(data) {
    const date = data.date || new Date().toISOString().split('T')[0];
    const monthKey = date.substring(0, 7);
    const amount = parseFloat(data.amount);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    const finalItem = (data.item || data.title || data.name || '').trim();
    if (!finalItem) {
      throw new Error('Expense item name is required');
    }

    const userEmail = this.currentUser?.email || null;
    const userId = this.currentUser?.id || null;

    const payload = {
      date,
      monthKey,
      item: finalItem,
      title: finalItem,
      amount: Math.round(amount * 100) / 100,
      paymentMethod: data.paymentMethod || 'UPI',
      category: data.category || 'Food',
      notes: (data.notes || '').trim()
    };

    const fallbackId = 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const localExpense = {
      id: fallbackId,
      ...payload,
      userEmail,
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.expenses.unshift(localExpense);
    this.saveLocalFallback();

    const syncPromise = (async () => {
      if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
        try {
          const serverExp = await api.createExpense(payload);
          if (serverExp && serverExp.id) {
            const idx = this.expenses.findIndex(e => e.id === fallbackId);
            if (idx !== -1) {
              this.expenses[idx] = { ...this.expenses[idx], ...serverExp, userEmail, userId };
              this.saveLocalFallback();
              return this.expenses[idx];
            }
          }
        } catch (err) {
          console.warn('[Store] Backend database sync unavailable, queued for retry:', err.message);
          this.queueOfflineOperation('add', localExpense);
        }
      }
      return localExpense;
    })();

    Object.assign(syncPromise, localExpense);
    return syncPromise;
  }

  /**
   * Updates an expense in the backend database and updates state.
   */
  updateExpense(id, data) {
    const index = this.expenses.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error('Expense not found');
    }

    const date = data.date || this.expenses[index].date;
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const userEmail = this.currentUser?.email || this.expenses[index].userEmail || null;
    const userId = this.currentUser?.id || this.expenses[index].userId || null;

    const finalItem = (data.item || data.title || data.name || '').trim() || this.expenses[index].item || this.expenses[index].title;

    const updatePayload = {
      date,
      monthKey: date.substring(0, 7),
      item: finalItem,
      title: finalItem,
      amount: Math.round(amount * 100) / 100,
      paymentMethod: data.paymentMethod || this.expenses[index].paymentMethod,
      category: data.category || this.expenses[index].category,
      notes: data.notes !== undefined ? (data.notes || '').trim() : this.expenses[index].notes
    };

    const updatedExpense = {
      ...this.expenses[index],
      ...updatePayload,
      userEmail,
      userId,
      updatedAt: Date.now()
    };

    this.expenses[index] = updatedExpense;
    this.saveLocalFallback();

    const syncPromise = (async () => {
      if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
        try {
          const res = await api.updateExpense(id, updatePayload);
          if (res) {
            this.expenses[index] = { ...this.expenses[index], ...res, userEmail, userId };
            this.saveLocalFallback();
            return this.expenses[index];
          }
        } catch (err) {
          console.warn('[Store] Backend update failed, queued for retry:', err.message);
          this.queueOfflineOperation('update', { id, ...updatePayload });
        }
      }
      return updatedExpense;
    })();

    Object.assign(syncPromise, updatedExpense);
    return syncPromise;
  }

  /**
   * Deletes an expense from the backend database and updates state.
   */
  deleteExpense(id) {
    const index = this.expenses.findIndex(item => item.id === id);
    let removed = null;
    if (index !== -1) {
      removed = this.expenses.splice(index, 1)[0];
    }
    this.saveLocalFallback();

    const syncPromise = (async () => {
      if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
        try {
          await api.deleteExpense(id);
        } catch (err) {
          console.warn('[Store] Backend delete failed, queued for retry:', err.message);
          this.queueOfflineOperation('delete', { id });
        }
      }
      return removed;
    })();

    Object.assign(syncPromise, removed || {});
    return syncPromise;
  }

  async duplicateExpense(id) {
    const original = this.getExpenseById(id);
    if (!original) {
      throw new Error('Expense to duplicate not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const duplicateData = {
      item: `${original.item} (Copy)`,
      amount: original.amount,
      date: today,
      paymentMethod: original.paymentMethod,
      category: original.category,
      notes: original.notes
    };

    return await this.addExpense(duplicateData);
  }

  async clearMonthExpenses(monthKey = this.selectedMonth) {
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      await api.deleteMonth(monthKey).catch(() => {});
    }
    this.expenses = this.expenses.filter(item => {
      const itemMonth = item.date ? item.date.substring(0, 7) : item.monthKey;
      return itemMonth !== monthKey;
    });
  }

  async clearAllExpenses() {
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      await api.deleteAllExpenses().catch(() => {});
    }
    this.expenses = [];
  }

  getDistinctMonths() {
    const monthsSet = new Set();
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthKey);
    monthsSet.add(this.selectedMonth);

    this.expenses.forEach(item => {
      const m = item.date ? item.date.substring(0, 7) : item.monthKey;
      if (m && /^\d{4}-\d{2}$/.test(m)) {
        monthsSet.add(m);
      }
    });

    Object.keys(this.budgets).forEach(m => {
      if (/^\d{4}-\d{2}$/.test(m)) {
        monthsSet.add(m);
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }

  getMonthKPIs(monthKey = this.selectedMonth) {
    const list = this.getExpensesForMonth(monthKey);
    const incList = this.getIncomeForMonth(monthKey);
    const budget = this.getBudget(monthKey);

    let totalSpent = 0;
    let highestExpense = { amount: 0, item: 'None' };
    const dailyExpenses = {};

    list.forEach(item => {
      const amt = Number(item.amount) || 0;
      totalSpent += amt;
      if (amt > highestExpense.amount) {
        highestExpense = { amount: amt, item: item.item };
      }
      if (item.date) {
        dailyExpenses[item.date] = (dailyExpenses[item.date] || 0) + amt;
      }
    });

    let totalIncome = 0;
    incList.forEach(item => {
      totalIncome += (Number(item.amount) || 0);
    });

    totalSpent = Math.round(totalSpent * 100) / 100;
    totalIncome = Math.round(totalIncome * 100) / 100;
    const balance = Math.round((totalIncome - totalSpent) * 100) / 100;

    // Previous month calculations
    const [y, m] = monthKey.split('-').map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const prevMonthKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const prevExpList = this.getExpensesForMonth(prevMonthKey);
    const prevIncList = this.getIncomeForMonth(prevMonthKey);
    const prevTotalSpent = Math.round(prevExpList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) * 100) / 100;
    const prevTotalIncome = Math.round(prevIncList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) * 100) / 100;
    const prevBalance = Math.round((prevTotalIncome - prevTotalSpent) * 100) / 100;

    const calcPct = (curr, prev) => {
      if (!prev || prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const expenseChangePercent = calcPct(totalSpent, prevTotalSpent);
    const incomeChangePercent = calcPct(totalIncome, prevTotalIncome);
    const balanceChangePercent = calcPct(balance, prevBalance);

    const remaining = Math.round((budget - totalSpent) * 100) / 100;
    const percentUsed = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
    const count = list.length;
    const avgExpense = count > 0 ? Math.round((totalSpent / count) * 100) / 100 : 0;

    // Highest spending day
    let highestSpendingDay = { date: 'None', amount: 0 };
    for (const [date, amt] of Object.entries(dailyExpenses)) {
      if (amt > highestSpendingDay.amount) {
        highestSpendingDay = { date, amount: Math.round(amt * 100) / 100 };
      }
    }

    return {
      monthKey,
      totalSpent,
      totalIncome,
      balance,
      prevTotalSpent,
      prevTotalIncome,
      prevBalance,
      expenseChangePercent,
      incomeChangePercent,
      balanceChangePercent,
      budget,
      remaining,
      percentUsed,
      percentage: percentUsed,
      actualPercent: percentUsed,
      isOverBudget: totalSpent > budget,
      count,
      transactionCount: count,
      avgExpense,
      averageExpense: avgExpense,
      highestExpense,
      highestSpendingDay,
      categoryBudgets: this.categoryBudgets[monthKey] || {},
      is50PercentReached: percentUsed >= 50,
      is90PercentReached: percentUsed >= 90,
      is100PercentReached: percentUsed >= 100
    };
  }

  getCategoryTotals(monthKey = this.selectedMonth) {
    const list = this.getExpensesForMonth(monthKey);
    const totals = {};

    CATEGORIES.forEach(cat => {
      totals[cat.id] = 0;
    });

    list.forEach(item => {
      const cat = item.category || 'Other';
      const amt = Number(item.amount) || 0;
      totals[cat] = (totals[cat] || 0) + amt;
    });

    return totals;
  }

  getCategoryBreakdown(monthKey = this.selectedMonth) {
    return this.getCategoryTotals(monthKey);
  }

  getPaymentMethodBreakdown(monthKey = this.selectedMonth) {
    const list = this.getExpensesForMonth(monthKey);
    const totals = {};

    PAYMENT_METHODS.forEach(pm => {
      totals[pm.id] = 0;
    });

    list.forEach(item => {
      const pm = item.paymentMethod || 'Cash';
      const amt = Number(item.amount) || 0;
      totals[pm] = (totals[pm] || 0) + amt;
    });

    return totals;
  }

  getDailySpending(monthKey = this.selectedMonth) {
    const list = this.getExpensesForMonth(monthKey);
    const daily = {};
    const parts = (monthKey || '').split('-').map(Number);
    const y = parts[0] || new Date().getFullYear();
    const m = parts[1] || (new Date().getMonth() + 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${monthKey}-${String(day).padStart(2, '0')}`;
      daily[dayStr] = 0;
    }
    list.forEach(item => {
      const date = item.date;
      if (date && date.startsWith(monthKey)) {
        daily[date] = (daily[date] || 0) + (Number(item.amount) || 0);
      }
    });
    return daily;
  }

  getMonthlyTrends(limit = 6) {
    const allMonths = this.getDistinctMonths();
    const targetMonths = allMonths.slice(0, limit).reverse();

    return targetMonths.map(monthKey => {
      const list = this.getExpensesForMonth(monthKey);
      const total = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const budget = this.getBudget(monthKey);
      return {
        monthKey,
        total: Math.round(total * 100) / 100,
        budget
      };
    });
  }

  getHistoricalMonthlyComparison(limit = 6) {
    const allMonths = this.getDistinctMonths();
    const targetMonths = allMonths.slice(0, limit).reverse();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return targetMonths.map(monthKey => {
      const list = this.getExpensesForMonth(monthKey);
      const totalSpent = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const budget = this.getBudget(monthKey);
      const [y, m] = monthKey.split('-');
      const date = new Date(Number(y), Number(m) - 1, 1);
      const label = `${monthNames[date.getMonth()]} '${String(y).slice(-2)}`;
      return {
        monthKey,
        label,
        totalSpent: Math.round(totalSpent * 100) / 100,
        budget
      };
    });
  }

  migrateGuestDataToUser(email) {
    return 0;
  }

  getInsights(monthKey = this.selectedMonth) {
    const kpi = this.getMonthKPIs(monthKey);
    const catTotals = this.getCategoryTotals(monthKey);
    const insights = [];

    // 1. Budget Pace Alert
    if (kpi.percentUsed >= 100) {
      insights.push({
        type: 'danger',
        icon: 'alert-triangle',
        title: 'Budget Exceeded',
        text: `You have crossed your monthly budget by ${Math.abs(kpi.remaining).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}.`
      });
    } else if (kpi.percentUsed >= 80) {
      insights.push({
        type: 'warning',
        icon: 'trending-up',
        title: 'High Budget Usage',
        text: `You have consumed ${kpi.percentUsed}% of your budget with ${formatRemainingDays(monthKey)} days left in the month.`
      });
    } else if (kpi.percentUsed > 0) {
      insights.push({
        type: 'success',
        icon: 'shield-check',
        title: 'Budget On Track',
        text: `You have consumed ${kpi.percentUsed}% of your budget. You have ${kpi.remaining.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} left to spend safely.`
      });
    }

    // 2. Dominant Category
    let topCat = null;
    let topCatAmt = 0;
    Object.keys(catTotals).forEach(cat => {
      if (catTotals[cat] > topCatAmt) {
        topCatAmt = catTotals[cat];
        topCat = cat;
      }
    });

    if (topCat && kpi.totalSpent > 0) {
      const topCatPct = Math.round((topCatAmt / kpi.totalSpent) * 100);
      insights.push({
        type: 'info',
        icon: 'pie-chart',
        title: `Top Expense: ${topCat}`,
        text: `${topCatPct}% of your total expenses (${topCatAmt.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}) was spent on ${topCat}.`
      });
    }

    return insights;
  }

  // ============================================================================
  // Income Management Methods
  // ============================================================================
  getAllIncome() {
    return [...this.income];
  }

  getIncomeForMonth(monthKey = this.selectedMonth) {
    return this.income.filter(item => {
      const itemMonth = item.date ? item.date.substring(0, 7) : item.monthKey;
      return itemMonth === monthKey;
    });
  }

  getMonthIncome(monthKey = this.selectedMonth) {
    return this.getIncomeForMonth(monthKey);
  }

  getIncomeById(id) {
    return this.income.find(item => item.id === id) || null;
  }

  addIncome(data) {
    const date = data.date || new Date().toISOString().split('T')[0];
    const monthKey = date.substring(0, 7);
    const amount = parseFloat(data.amount);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Income amount must be a positive number');
    }
    const source = (data.source || data.title || data.item || '').trim();
    if (!source) {
      throw new Error('Income source is required');
    }

    const payload = {
      date,
      monthKey,
      source,
      amount: Math.round(amount * 100) / 100,
      paymentMethod: data.paymentMethod || 'UPI',
      notes: (data.notes || '').trim()
    };

    const fallbackId = 'inc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const localIncome = {
      id: fallbackId,
      ...payload,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.income.unshift(localIncome);
    this.saveLocalFallback();

    const syncPromise = (async () => {
      if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
        try {
          const serverInc = await api.createIncome(payload);
          if (serverInc && serverInc.id) {
            const idx = this.income.findIndex(i => i.id === fallbackId);
            if (idx !== -1) {
              this.income[idx] = { ...this.income[idx], ...serverInc };
              this.saveLocalFallback();
              return this.income[idx];
            }
          }
        } catch (err) {
          console.warn('[Store] Income sync failed:', err.message);
        }
      }
      return localIncome;
    })();

    Object.assign(syncPromise, localIncome);
    return syncPromise;
  }

  updateIncome(id, data) {
    const index = this.income.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error('Income entry not found');
    }

    const date = data.date || this.income[index].date;
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const payload = {
      date,
      monthKey: date.substring(0, 7),
      source: data.source ? data.source.trim() : this.income[index].source,
      amount: Math.round(amount * 100) / 100,
      paymentMethod: data.paymentMethod || this.income[index].paymentMethod,
      notes: data.notes !== undefined ? (data.notes || '').trim() : this.income[index].notes
    };

    const updated = { ...this.income[index], ...payload, updatedAt: Date.now() };
    this.income[index] = updated;
    this.saveLocalFallback();

    const syncPromise = (async () => {
      if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
        try {
          const res = await api.updateIncome(id, payload);
          if (res) {
            this.income[index] = { ...this.income[index], ...res };
            this.saveLocalFallback();
            return this.income[index];
          }
        } catch (err) {
          console.warn('[Store] Income update failed:', err.message);
        }
      }
      return updated;
    })();

    Object.assign(syncPromise, updated);
    return syncPromise;
  }

  deleteIncome(id) {
    const index = this.income.findIndex(item => item.id === id);
    let removed = null;
    if (index !== -1) {
      removed = this.income.splice(index, 1)[0];
    }
    this.saveLocalFallback();

    const syncPromise = (async () => {
      if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
        try {
          await api.deleteIncome(id);
        } catch (err) {
          console.warn('[Store] Income delete failed:', err.message);
        }
      }
      return removed;
    })();

    Object.assign(syncPromise, removed || {});
    return syncPromise;
  }

  clearMonthIncome(monthKey = this.selectedMonth) {
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      api.deleteIncomeMonth(monthKey).catch(() => {});
    }
    this.income = this.income.filter(item => {
      const itemMonth = item.date ? item.date.substring(0, 7) : item.monthKey;
      return itemMonth !== monthKey;
    });
  }

  // ============================================================================
  // Category Budgets Methods
  // ============================================================================
  getCategoryBudgets(monthKey = this.selectedMonth) {
    return this.categoryBudgets[monthKey] || {};
  }

  async setCategoryBudget(monthKey, category, amount) {
    const val = Math.round(parseFloat(amount) * 100) / 100;
    if (!this.categoryBudgets[monthKey]) {
      this.categoryBudgets[monthKey] = {};
    }
    this.categoryBudgets[monthKey][category] = val;

    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        await api.setCategoryBudget(monthKey, category, val);
      } catch (err) {
        console.warn('[Store] Set category budget failed:', err.message);
      }
    }
    return true;
  }

  async deleteCategoryBudget(monthKey, category) {
    if (this.categoryBudgets[monthKey]) {
      delete this.categoryBudgets[monthKey][category];
    }
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        await api.deleteCategoryBudget(monthKey, category);
      } catch (err) {}
    }
    return true;
  }

  // ============================================================================
  // Categories Methods
  // ============================================================================
  getCategories() {
    return this.categories.map(c => ({
      ...c,
      label: c.label || c.name || c.id,
      name: c.name || c.label || c.id
    }));
  }

  async addCategory(data) {
    const catName = (data.name || data.label || '').trim();
    const newCat = {
      id: data.id || ('cat_' + Date.now()),
      name: catName,
      label: catName,
      icon: data.icon || 'tag',
      color: data.color || '#38bdf8',
      bg: data.bg || `${data.color || '#38bdf8'}26`,
      isDefault: false
    };
    this.categories.push(newCat);

    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        const res = await api.createCategory(newCat);
        if (res?.category) {
          const idx = this.categories.findIndex(c => c.id === newCat.id);
          if (idx !== -1) this.categories[idx] = res.category;
        }
      } catch (err) {
        console.warn('[Store] Add category API failed:', err.message);
      }
    }
    return newCat;
  }

  async createCategory(data) {
    return this.addCategory(data);
  }

  async deleteCategory(id, force = false) {
    this.categories = this.categories.filter(c => c.id !== id);
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      await api.deleteCategory(id, force);
    }
    return true;
  }

  // ============================================================================
  // Goals Methods
  // ============================================================================
  getGoals() {
    return [...this.goals];
  }

  getGoalById(id) {
    return this.goals.find(g => g.id === id) || null;
  }

  async addGoal(data) {
    const fallbackId = 'goal_' + Date.now();
    const newGoal = {
      id: fallbackId,
      name: data.name.trim(),
      targetAmount: Math.round(parseFloat(data.targetAmount) * 100) / 100,
      currentAmount: data.currentAmount ? Math.round(parseFloat(data.currentAmount) * 100) / 100 : 0,
      deadline: data.deadline || '',
      category: data.category || 'Savings',
      icon: data.icon || 'target',
      color: data.color || '#38bdf8',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.goals.unshift(newGoal);

    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        const res = await api.createGoal(newGoal);
        if (res && res.id) {
          const idx = this.goals.findIndex(g => g.id === fallbackId);
          if (idx !== -1) this.goals[idx] = res;
        }
      } catch (err) {
        console.warn('[Store] Create goal API failed:', err.message);
      }
    }
    return newGoal;
  }

  async createGoal(data) {
    return this.addGoal(data);
  }

  async updateGoal(id, data) {
    const idx = this.goals.findIndex(g => g.id === id);
    if (idx === -1) return null;
    this.goals[idx] = { ...this.goals[idx], ...data, updatedAt: Date.now() };

    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        const res = await api.updateGoal(id, data);
        if (res) this.goals[idx] = res;
      } catch (err) {}
    }
    return this.goals[idx];
  }

  async addGoalFunds(id, amount) {
    const numAmount = Math.round(parseFloat(amount) * 100) / 100;
    const idx = this.goals.findIndex(g => g.id === id);
    if (idx !== -1) {
      this.goals[idx].currentAmount = Math.round((this.goals[idx].currentAmount + numAmount) * 100) / 100;
    }
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        const res = await api.addGoalFunds(id, numAmount);
        if (res?.goal && idx !== -1) this.goals[idx] = res.goal;
      } catch (err) {}
    }
    return idx !== -1 ? this.goals[idx] : null;
  }

  async deleteGoal(id) {
    this.goals = this.goals.filter(g => g.id !== id);
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        await api.deleteGoal(id);
      } catch (err) {}
    }
    return true;
  }

  // ============================================================================
  // Profile & Settings Methods
  // ============================================================================
  getProfile() {
    return this.profile;
  }

  async updateProfile(data) {
    this.profile = { ...(this.profile || {}), ...data };
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        const res = await api.updateProfile(data);
        if (res) this.profile = res;
      } catch (err) {}
    }
    return this.profile;
  }

  getSettings() {
    return this.settings || {
      currency: 'INR',
      theme: 'midnight',
      expenseAlerts: true,
      budgetAlerts: true,
      weeklyReports: true
    };
  }

  getUserSettings() {
    return this.getSettings();
  }

  getProfileStats() {
    const allExpenses = this.getAllExpenses();
    const allIncome = this.getAllIncome();
    const totalExpense = allExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalIncome = allIncome.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    return {
      totalExpense,
      totalIncome,
      totalTransactions: allExpenses.length + allIncome.length,
      activeGoals: this.goals ? this.goals.length : 0
    };
  }

  async updateSettings(data) {
    this.settings = { ...this.getSettings(), ...data };
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        const res = await api.updateSettings(data);
        if (res) this.settings = res;
      } catch (err) {}
    }
    return this.settings;
  }

  setCurrentUser(user) {
    const prevId = this.currentUser?.id;
    this.currentUser = user || null;
    if (!user || user.id !== prevId) {
      this.expenses = [];
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUserExpenseCount(email = (this.currentUser ? this.currentUser.email : null)) {
    return this.expenses.length;
  }

  loadDemoData() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');

    const demoItems = [
      { item: 'Grocery Shopping at D-Mart', amount: 3450, category: 'Food', paymentMethod: 'UPI', date: `${y}-${m}-02`, notes: 'Monthly provisions and pantry essentials' },
      { item: 'Electricity & High-speed WiFi', amount: 1850, category: 'Bills', paymentMethod: 'Debit Card', date: `${y}-${m}-04`, notes: 'Broadband + apartment electricity' },
      { item: 'Metro Travel SmartCard Recharge', amount: 800, category: 'Travel', paymentMethod: 'UPI', date: `${y}-${m}-06`, notes: 'Daily commute to college/office' },
      { item: 'Zomato Biryani & Sweets with Friends', amount: 1240, category: 'Food', paymentMethod: 'UPI', date: `${y}-${m}-08`, notes: 'Weekend celebration dinner' },
      { item: 'Udemy FullStack System Design Course', amount: 549, category: 'Education', paymentMethod: 'Credit Card', date: `${y}-${m}-10`, notes: 'Skill enhancement bootcamp' },
      { item: 'BookMyShow Movie & Popcorn Outing', amount: 920, category: 'Entertainment', paymentMethod: 'UPI', date: `${y}-${m}-12`, notes: 'Sci-Fi blockbuster premiere' },
      { item: 'Apollo Pharmacy Vitamins & Skincare', amount: 1100, category: 'Health', paymentMethod: 'Cash', date: `${y}-${m}-15`, notes: 'Monthly multivitamin stock' },
      { item: 'Amazon Lifestyle Shoes & Denim', amount: 2499, category: 'Shopping', paymentMethod: 'Credit Card', date: `${y}-${m}-18`, notes: 'Campus casual wear sale' }
    ];

    this.expenses = demoItems.map((item, index) => ({
      id: 'demo_' + index + '_' + Date.now(),
      ...item,
      monthKey: item.date.substring(0, 7),
      createdAt: Date.now() - (30 - index) * 86400000,
      updatedAt: Date.now() - (30 - index) * 86400000
    }));

    this.budgets = {
      '2026-09': 5000,
      '2026-08': 5000,
      '2026-07': 5000
    };
  }
}

function formatRemainingDays(monthKey) {
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (monthKey !== currentKey) return 0;

  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - today.getDate());
}

export const store = new ExpenseStore();

// Guarantee that convenience methods and aliases are attached directly to prototype and instance
ExpenseStore.prototype.getMonthExpenses = ExpenseStore.prototype.getExpensesForMonth;
ExpenseStore.prototype.getMonthIncome = ExpenseStore.prototype.getIncomeForMonth;
ExpenseStore.prototype.setMonthlyBudget = ExpenseStore.prototype.setBudget;
ExpenseStore.prototype.getUserSettings = ExpenseStore.prototype.getSettings;

store.getMonthExpenses = function(monthKey = this.selectedMonth) {
  return this.getExpensesForMonth(monthKey);
};
store.getMonthIncome = function(monthKey = this.selectedMonth) {
  return this.getIncomeForMonth(monthKey);
};
store.setMonthlyBudget = function(monthKey, amount) {
  return this.setBudget(monthKey, amount);
};
store.getUserSettings = function() {
  return this.getSettings();
};
