/**
 * store.js - State Management & LocalStorage Persistence
 * Handles all CRUD operations, monthly budgets, calculations, and demo data.
 */

import { api } from './api.js';
import { cloudSync } from './firebase-sync.js';

const STORAGE_KEYS = {
  EXPENSES: 'hisabo_expenses_v1',
  BUDGETS: 'hisabo_budgets_v1',
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
    this.budgets = {};
    this.currentUser = null;
    this.selectedMonth = this.getInitialMonth();
    this.init();
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

  init() {
    try {
      if (typeof localStorage === 'undefined') {
        this.loadDemoData();
        return;
      }
      const storedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES) || 
                             localStorage.getItem('rupeeflow_expenses_v1');
      if (storedExpenses) {
        this.expenses = JSON.parse(storedExpenses);
      } else {
        this.loadDemoData();
      }

      const storedBudgets = localStorage.getItem(STORAGE_KEYS.BUDGETS) || 
                            localStorage.getItem('rupeeflow_budgets_v1');
      if (storedBudgets) {
        this.budgets = JSON.parse(storedBudgets);
      } else {
        this.budgets = {
          '2026-09': 25000,
          '2026-08': 25000,
          '2026-07': 22000
        };
        this.saveBudgets();
      }
    } catch (e) {
      console.error('Failed to parse localStorage data:', e);
      this.expenses = [];
      this.budgets = {};
    }
  }

  saveExpenses() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(this.expenses));
        localStorage.setItem('rupeeflow_expenses_v1', JSON.stringify(this.expenses));
      }
    } catch (e) {
      console.error('Error saving expenses:', e);
    }
  }

  saveBudgets() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(this.budgets));
        localStorage.setItem('rupeeflow_budgets_v1', JSON.stringify(this.budgets));
      }
    } catch (e) {
      console.error('Error saving budgets:', e);
    }
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

  setBudget(monthKey, amount) {
    const val = Number(amount);
    if (!isNaN(val) && val >= 0) {
      this.budgets[monthKey] = Math.round(val);
      this.saveBudgets();
      if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
        api.setBudget(monthKey, Math.round(val)).then(res => {
          if (res?.alertInfo?.alertsTriggered?.length && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hisabo:budget-alerts', { detail: res.alertInfo }));
          }
        }).catch(() => {});
      }
      if (this.currentUser?.email) {
        cloudSync.saveBudgets(this.currentUser.email, this.budgets).catch(() => {});
      }
      return true;
    }
    return false;
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

  addExpense(data) {
    const date = data.date || new Date().toISOString().split('T')[0];
    const monthKey = date.substring(0, 7);
    const amount = parseFloat(data.amount);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    if (!data.item || !data.item.trim()) {
      throw new Error('Expense item name is required');
    }

    const newExpense = {
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      date: date,
      monthKey: monthKey,
      item: data.item.trim(),
      amount: Math.round(amount * 100) / 100,
      paymentMethod: data.paymentMethod || 'UPI',
      category: data.category || 'Food',
      notes: (data.notes || '').trim(),
      userEmail: data.userEmail || (this.currentUser ? this.currentUser.email : null),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.expenses.unshift(newExpense);
    this.saveExpenses();

    // Async cloud sync if authenticated
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      api.createExpense(newExpense).then(res => {
        if (res?.alertInfo?.alertsTriggered?.length && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hisabo:budget-alerts', { detail: res.alertInfo }));
        }
      }).catch(() => {});
    }

    // Real-time Firebase Firestore cloud sync
    const activeEmail = newExpense.userEmail || (this.currentUser ? this.currentUser.email : null);
    if (activeEmail) {
      cloudSync.saveExpense(activeEmail, newExpense).catch(() => {});
    }

    return newExpense;
  }

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

    this.expenses[index] = {
      ...this.expenses[index],
      date: date,
      monthKey: date.substring(0, 7),
      item: data.item.trim(),
      amount: Math.round(amount * 100) / 100,
      paymentMethod: data.paymentMethod || this.expenses[index].paymentMethod,
      category: data.category || this.expenses[index].category,
      notes: (data.notes || '').trim(),
      updatedAt: Date.now()
    };

    this.saveExpenses();

    // Async cloud sync if authenticated
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      api.updateExpense(id, this.expenses[index]).then(res => {
        if (res?.alertInfo?.alertsTriggered?.length && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hisabo:budget-alerts', { detail: res.alertInfo }));
        }
      }).catch(() => {});
    }

    // Real-time Firebase Firestore cloud sync
    const activeEmail = this.expenses[index].userEmail || (this.currentUser ? this.currentUser.email : null);
    if (activeEmail) {
      cloudSync.saveExpense(activeEmail, this.expenses[index]).catch(() => {});
    }

    return this.expenses[index];
  }

  deleteExpense(id) {
    const initialLength = this.expenses.length;
    this.expenses = this.expenses.filter(item => item.id !== id);
    const removed = initialLength > this.expenses.length;
    if (removed) {
      this.saveExpenses();
      if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
        api.deleteExpense(id).catch(() => {});
      }
      if (this.currentUser?.email) {
        cloudSync.deleteExpense(this.currentUser.email, id).catch(() => {});
      }
    }
    return removed;
  }

  duplicateExpense(id) {
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

    return this.addExpense(duplicateData);
  }

  clearMonthExpenses(monthKey = this.selectedMonth) {
    this.expenses = this.expenses.filter(item => {
      const itemMonth = item.date ? item.date.substring(0, 7) : item.monthKey;
      return itemMonth !== monthKey;
    });
    this.saveExpenses();
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      api.deleteMonth(monthKey).catch(() => {});
    }
  }

  clearAllExpenses() {
    this.expenses = [];
    this.saveExpenses();
    if (typeof fetch !== 'undefined' && api?.hasToken && api.hasToken()) {
      api.deleteAllExpenses().catch(() => {});
    }
  }

  getDistinctMonths() {
    const monthsSet = new Set();
    // Always include current selected month and real today month
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
      totalSpent += item.amount;
      if (item.amount > highestExpense.amount) {
        highestExpense = { amount: item.amount, item: item.item };
      }
    });

    totalSpent = Math.round(totalSpent * 100) / 100;
    const remaining = Math.round((budget - totalSpent) * 100) / 100;
    const transactionCount = list.length;
    const averageExpense = transactionCount > 0 ? Math.round((totalSpent / transactionCount) * 100) / 100 : 0;
    const percentUsed = budget > 0 ? Math.min(100, Math.round((totalSpent / budget) * 100)) : 100;
    const actualPercent = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
    const is50PercentReached = actualPercent >= 50;
    const is90PercentReached = actualPercent >= 90;
    const is100PercentReached = actualPercent >= 100 || totalSpent >= budget;
    const isOverBudget = totalSpent > budget;
    const isNearBudget = !isOverBudget && is90PercentReached;

    return {
      monthKey,
      totalSpent,
      budget,
      remaining,
      transactionCount,
      averageExpense,
      highestExpense,
      percentUsed,
      actualPercent,
      is50PercentReached,
      is90PercentReached,
      is100PercentReached,
      isOverBudget,
      isNearBudget
    };
  }

  getCategoryBreakdown(monthKey = this.selectedMonth) {
    const list = this.getExpensesForMonth(monthKey);
    const breakdown = {};

    CATEGORIES.forEach(c => {
      breakdown[c.id] = 0;
    });

    list.forEach(item => {
      const cat = breakdown[item.category] !== undefined ? item.category : 'Other';
      breakdown[cat] += item.amount;
    });

    return breakdown;
  }

  getPaymentMethodBreakdown(monthKey = this.selectedMonth) {
    const list = this.getExpensesForMonth(monthKey);
    const breakdown = {};

    PAYMENT_METHODS.forEach(p => {
      breakdown[p.id] = 0;
    });

    list.forEach(item => {
      const method = breakdown[item.paymentMethod] !== undefined ? item.paymentMethod : 'Other';
      breakdown[method] += item.amount;
    });

    return breakdown;
  }

  getDailySpending(monthKey = this.selectedMonth) {
    const list = this.getExpensesForMonth(monthKey);
    const [year, month] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const dailyMap = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${monthKey}-${String(day).padStart(2, '0')}`;
      dailyMap[dayStr] = 0;
    }

    list.forEach(item => {
      if (dailyMap[item.date] !== undefined) {
        dailyMap[item.date] += item.amount;
      }
    });

    return dailyMap;
  }

  getHistoricalMonthlyComparison(numMonths = 6) {
    const months = this.getDistinctMonths().slice(0, numMonths).reverse();
    return months.map(mKey => {
      const kpis = this.getMonthKPIs(mKey);
      const [y, m] = mKey.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = dateObj.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      return {
        monthKey: mKey,
        label,
        totalSpent: kpis.totalSpent,
        budget: kpis.budget
      };
    });
  }

  loadDemoData() {
    const demoItems = [
      // Previous Month (August 2026)
      { date: '2026-08-01', item: 'Hostel Rent', amount: 6500, paymentMethod: 'Bank Transfer', category: 'Hostel', notes: 'August hostel rent' },
      { date: '2026-08-05', item: 'New Running Shoes', amount: 2499, paymentMethod: 'Credit Card', category: 'Shopping', notes: 'Independence Day Sale' },
      { date: '2026-08-10', item: 'Dinner at Barbeque Nation', amount: 1800, paymentMethod: 'Debit Card', category: 'Food', notes: 'Birthday celebration' },
      { date: '2026-08-15', item: 'Weekend Road Trip Petrol & Tolls', amount: 2200, paymentMethod: 'UPI', category: 'Travel', notes: 'Long weekend getaway' },
      { date: '2026-08-20', item: 'Mobile Postpaid & OTT Subscription', amount: 899, paymentMethod: 'UPI', category: 'Bills', notes: 'Airtel + Netflix' },
      { date: '2026-08-26', item: 'Books & Stationery for Semester', amount: 1150, paymentMethod: 'Cash', category: 'Education', notes: 'Reference guides' },

      // July 2026
      { date: '2026-07-02', item: 'Hostel Rent', amount: 6500, paymentMethod: 'Bank Transfer', category: 'Hostel', notes: 'July rent' },
      { date: '2026-07-12', item: 'Formal Shirts & Trousers', amount: 3200, paymentMethod: 'Credit Card', category: 'Shopping', notes: 'Campus placement preparation' },
      { date: '2026-07-18', item: 'Dental Checkup & Cleaning', amount: 1500, paymentMethod: 'UPI', category: 'Health', notes: 'Clinic visit' },
      { date: '2026-07-25', item: 'Cafe Coffee Day Meetup', amount: 480, paymentMethod: 'UPI', category: 'Food', notes: 'Study group' }
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

    this.saveExpenses();
    this.saveBudgets();
  }

  setCurrentUser(user) {
    this.currentUser = user || null;
    if (user && user.email) {
      this.attachCloudSync(user.email);
    } else {
      cloudSync.disconnect();
    }
  }

  attachCloudSync(email) {
    if (!email || typeof window === 'undefined') return;

    // Real-time Firestore expenses listener across all open browsers
    cloudSync.subscribeExpenses(email, (cloudExpenses) => {
      if (Array.isArray(cloudExpenses)) {
        if (cloudExpenses.length > 0 || this.expenses.length === 0) {
          this.expenses = cloudExpenses;
          this.saveExpenses();
        } else if (this.expenses.length > 0 && cloudExpenses.length === 0) {
          // Upload local records to populate new cloud account
          cloudSync.syncLocalToCloud(email, this.expenses, this.budgets).catch(() => {});
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hisabo:cloud-sync', { detail: { type: 'expenses', count: this.expenses.length } }));
        }
      }
    });

    // Real-time Firestore budgets listener
    cloudSync.subscribeBudgets(email, (cloudBudgets) => {
      if (cloudBudgets && typeof cloudBudgets === 'object' && Object.keys(cloudBudgets).length > 0) {
        this.budgets = { ...this.budgets, ...cloudBudgets };
        this.saveBudgets();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hisabo:cloud-sync', { detail: { type: 'budgets' } }));
        }
      }
    });
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUserExpenseCount(email = (this.currentUser ? this.currentUser.email : null)) {
    if (!email) return this.expenses.length;
    return this.expenses.filter(e => e.userEmail === email || !e.userEmail).length;
  }

  migrateGuestDataToUser(email) {
    if (!email) return 0;
    let count = 0;
    this.expenses.forEach(item => {
      if (!item.userEmail) {
        item.userEmail = email;
        count++;
      }
    });
    if (count > 0) {
      this.saveExpenses();
    }
    return count;
  }

  async syncWithBackend() {
    if (typeof fetch === 'undefined' || !api?.hasToken || !api.hasToken()) {
      return { synced: false, count: this.expenses.length };
    }

    try {
      // 1. Upload local expenses to backend DB
      if (this.expenses.length > 0) {
        await api.syncExpenses(this.expenses);
      }

      // 2. Fetch authoritative user expenses from backend
      const cloudExpenses = await api.getExpenses();
      if (Array.isArray(cloudExpenses) && cloudExpenses.length > 0) {
        this.expenses = cloudExpenses;
        this.saveExpenses();
      }

      // 3. Fetch authoritative budgets from backend
      const cloudBudgets = await api.getBudgets();
      if (cloudBudgets && typeof cloudBudgets === 'object' && Object.keys(cloudBudgets).length > 0) {
        this.budgets = { ...this.budgets, ...cloudBudgets };
        this.saveBudgets();
      }

      return { synced: true, count: this.expenses.length };
    } catch (err) {
      console.warn('[Store] Failed to sync with backend:', err.message);
      return { synced: false, error: err.message };
    }
  }
}

export const store = new ExpenseStore();
