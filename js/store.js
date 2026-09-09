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

export const DEFAULT_BUDGET = 25000;

class ExpenseStore {
  constructor() {
    this.expenses = [];
    this.budgets = {
      '2026-09': 25000,
      '2026-08': 25000,
      '2026-07': 22000
    };
    this.currentUser = null;
    this.selectedMonth = this.getInitialMonth();
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
      const [expenses, budgets] = await Promise.all([
        api.getExpenses(),
        api.getBudgets().catch(() => ({}))
      ]);

      this.expenses = Array.isArray(expenses) ? expenses : [];
      if (budgets && typeof budgets === 'object') {
        this.budgets = { ...this.budgets, ...budgets };
      }
      this.saveLocalFallback();
      return true;
    } catch (err) {
      console.warn('[Store] Could not load expenses from database, loading local fallback:', err.message);
      this.loadLocalFallback();
      return false;
    }
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

  getExpenseById(id) {
    return this.expenses.find(item => item.id === id) || null;
  }

  /**
   * Adds an expense to the backend database and updates state.
   */
  async addExpense(data) {
    const date = data.date || new Date().toISOString().split('T')[0];
    const monthKey = date.substring(0, 7);
    const amount = parseFloat(data.amount);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    if (!data.item || !data.item.trim()) {
      throw new Error('Expense item name is required');
    }

    const payload = {
      date,
      monthKey,
      item: data.item.trim(),
      amount: Math.round(amount * 100) / 100,
      paymentMethod: data.paymentMethod || 'UPI',
      category: data.category || 'Food',
      notes: (data.notes || '').trim()
    };

    let newExpense;
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        // Save directly to the backend database
        newExpense = await api.createExpense(payload);
      } catch (err) {
        console.warn('[Store] Backend database sync unavailable, using local store:', err.message);
        newExpense = {
          id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          ...payload,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }
    } else {
      // Offline / guest fallback
      newExpense = {
        id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        ...payload,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    this.expenses.unshift(newExpense);
    this.saveLocalFallback();
    return newExpense;
  }

  /**
   * Updates an expense in the backend database and updates state.
   */
  async updateExpense(id, data) {
    const index = this.expenses.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error('Expense not found');
    }

    const date = data.date || this.expenses[index].date;
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const updatePayload = {
      date,
      monthKey: date.substring(0, 7),
      item: data.item ? data.item.trim() : this.expenses[index].item,
      amount: Math.round(amount * 100) / 100,
      paymentMethod: data.paymentMethod || this.expenses[index].paymentMethod,
      category: data.category || this.expenses[index].category,
      notes: data.notes !== undefined ? (data.notes || '').trim() : this.expenses[index].notes
    };

    let updatedExpense;
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        updatedExpense = await api.updateExpense(id, updatePayload);
      } catch (err) {
        console.warn('[Store] Backend update failed, updating locally:', err.message);
        updatedExpense = {
          ...this.expenses[index],
          ...updatePayload,
          updatedAt: Date.now()
        };
      }
    } else {
      updatedExpense = {
        ...this.expenses[index],
        ...updatePayload,
        updatedAt: Date.now()
      };
    }

    this.expenses[index] = updatedExpense;
    this.saveLocalFallback();
    return updatedExpense;
  }

  /**
   * Deletes an expense from the backend database and updates state.
   */
  async deleteExpense(id) {
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      try {
        await api.deleteExpense(id);
      } catch (err) {
        console.warn('[Store] Backend delete failed, deleting locally:', err.message);
      }
    }
    const index = this.expenses.findIndex(item => item.id === id);
    let removed = null;
    if (index !== -1) {
      removed = this.expenses.splice(index, 1)[0];
    }
    this.saveLocalFallback();
    return removed;
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
    const budget = this.getBudget(monthKey);

    let totalSpent = 0;
    let highestExpense = { amount: 0, item: 'None' };

    list.forEach(item => {
      const amt = Number(item.amount) || 0;
      totalSpent += amt;
      if (amt > highestExpense.amount) {
        highestExpense = { amount: amt, item: item.item };
      }
    });

    totalSpent = Math.round(totalSpent * 100) / 100;
    const remaining = Math.round((budget - totalSpent) * 100) / 100;
    const percentUsed = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
    const count = list.length;
    const avgExpense = count > 0 ? Math.round((totalSpent / count) * 100) / 100 : 0;

    return {
      totalSpent,
      budget,
      remaining,
      percentUsed,
      count,
      avgExpense,
      highestExpense
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

  setCurrentUser(user) {
    this.currentUser = user || null;
    if (!user) {
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
      '2026-09': 25000,
      '2026-08': 25000,
      '2026-07': 22000
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
