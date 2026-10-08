/**
 * api.js - Client-Side REST API Client for Hisabo
 * Handles communication with the Express backend, bearer token injection,
 * and seamless fallback handling.
 */

const TOKEN_STORAGE_KEY = 'hisabo_auth_token_v1';

class ApiService {
  constructor() {
    this.token = this.loadToken();
  }

  loadToken() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  setToken(token) {
    this.token = token;
    try {
      if (typeof localStorage !== 'undefined') {
        if (token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error('[API] Failed to persist token:', e);
    }
  }

  getToken() {
    return this.token;
  }

  hasToken() {
    return Boolean(this.token);
  }

  isNetworkError(err) {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    return (
      err.isNetworkError === true ||
      err.name === 'TypeError' ||
      err.name === 'NetworkError' ||
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('connection refused') ||
      msg.includes('offline') ||
      msg.includes('econnrefused') ||
      msg.includes('aborted')
    );
  }

  isOnline() {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  async request(endpoint, options = {}) {
    let url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (typeof window === 'undefined' && url.startsWith('/')) {
      url = `http://localhost:${(typeof process !== 'undefined' && process.env?.APP_PORT) || 3000}${url}`;
    }
    const headers = {
      Accept: 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let bodyData = options.body;
    if (bodyData && typeof bodyData === 'object' && !(bodyData instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      bodyData = JSON.stringify(bodyData);
    }

    const maxRetries = options.retries !== undefined ? options.retries : 2;
    const retryDelay = options.retryDelay || 500;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          ...options,
          credentials: 'same-origin',
          body: bodyData,
          headers
        });
        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        const data = isJson ? await res.json() : await res.text();

        if (!res.ok || (!isJson && typeof data === 'string' && data.trim().startsWith('<'))) {
          const msg = (isJson && data?.error)
            ? data.error
            : (data && typeof data === 'string' && data.trim().startsWith('<'))
              ? 'Backend API route is offline or returned HTML fallback'
              : `HTTP ${res.status}: ${res.statusText}`;
          const err = new Error(msg);
          err.status = res.status;
          err.data = data;
          throw err;
        }

        return data;
      } catch (err) {
        lastError = err;
        const isNetworkErr = this.isNetworkError(err);
        if (isNetworkErr) {
          err.isNetworkError = true;
          err.canRetry = true;
          err.retry = () => this.request(endpoint, options);
        }

        // Retry on network errors or transient 502/503/504
        const isTransientStatus = err.status === 502 || err.status === 503 || err.status === 504;
        if ((isNetworkErr || isTransientStatus) && attempt < maxRetries) {
          const backoff = retryDelay * Math.pow(2, attempt);
          console.warn(`[API] Network/Server transient issue on attempt ${attempt + 1}/${maxRetries + 1}. Retrying in ${backoff}ms...`);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }

        throw err;
      }
    }
    throw lastError;
  }

  // ============================================================================
  // Auth APIs
  // ============================================================================

  async sendOtp(payload) {
    return this.request('/api/auth/send-otp', {
      method: 'POST',
      body: payload
    });
  }

  async signup(payload) {
    const data = await this.request('/api/auth/signup', {
      method: 'POST',
      body: payload
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async verifyOtp(payload) {
    const data = await this.request('/api/auth/verify-otp', {
      method: 'POST',
      body: payload
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async resendOtp(payload) {
    return this.request('/api/auth/resend-otp', {
      method: 'POST',
      body: payload
    });
  }

  async login(credentials) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: credentials
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async googleAuth(payload) {
    const data = await this.request('/api/auth/google', {
      method: 'POST',
      body: payload
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async forgotPassword(payload) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: payload
    });
  }

  async resetPassword(payload) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: payload
    });
  }

  async configureMail(config) {
    return await this.request('/api/auth/configure-mail', {
      method: 'POST',
      body: config
    });
  }

  async enableDevMode() {
    return await this.request('/api/auth/enable-dev-mode', {
      method: 'POST'
    });
  }

  async getMailStatus() {
    return await this.request('/api/auth/mail-status');
  }

  async getMe() {
    try {
      const data = await this.request('/api/auth/me');
      if (data && data.user) {
        return data.user;
      }
      return null;
    } catch (err) {
      if (err.status === 401) {
        this.setToken(null);
      }
      return null;
    }
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      this.setToken(null);
    }
  }

  // ============================================================================
  // Expenses APIs
  // ============================================================================

  async getExpenses({ month, category, search, sort } = {}) {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    if (sort) params.append('sort', sort);

    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await this.request(`/api/expenses${query}`);
    return data.expenses || [];
  }

  async createExpense(expenseData) {
    const data = await this.request('/api/expenses', {
      method: 'POST',
      body: expenseData
    });
    return data.expense;
  }

  async updateExpense(id, expenseData) {
    const data = await this.request(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: expenseData
    });
    return data.expense;
  }

  async deleteExpense(id) {
    return await this.request(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  async syncExpenses(expensesList) {
    return await this.request('/api/expenses/sync', {
      method: 'POST',
      body: { expenses: expensesList }
    });
  }

  async deleteMonth(monthKey) {
    return await this.request(`/api/expenses/month/${encodeURIComponent(monthKey)}`, {
      method: 'DELETE'
    });
  }

  async deleteAllExpenses() {
    return await this.request('/api/expenses/all', {
      method: 'DELETE'
    });
  }

  // ============================================================================
  // Budgets APIs
  // ============================================================================

  async getBudgets() {
    const data = await this.request('/api/budgets');
    return data.budgets || {};
  }

  async setBudget(monthKey, amount) {
    return await this.request(`/api/budgets/${encodeURIComponent(monthKey)}`, {
      method: 'PUT',
      body: { amount }
    });
  }

  async getCategoryBudgets(monthKey) {
    const data = await this.request(`/api/budgets/categories/${encodeURIComponent(monthKey)}`);
    return data.categoryBudgets || {};
  }

  async setCategoryBudget(monthKey, category, amount) {
    return await this.request(`/api/budgets/categories/${encodeURIComponent(monthKey)}`, {
      method: 'POST',
      body: { category, amount }
    });
  }

  async deleteCategoryBudget(monthKey, category) {
    return await this.request(`/api/budgets/categories/${encodeURIComponent(monthKey)}/${encodeURIComponent(category)}`, {
      method: 'DELETE'
    });
  }

  // ============================================================================
  // Income APIs
  // ============================================================================

  async getIncome({ month, source, search, sort } = {}) {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (source) params.append('source', source);
    if (search) params.append('search', search);
    if (sort) params.append('sort', sort);

    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await this.request(`/api/income${query}`);
    return data.income || [];
  }

  async createIncome(incomeData) {
    const data = await this.request('/api/income', {
      method: 'POST',
      body: incomeData
    });
    return data.income;
  }

  async updateIncome(id, incomeData) {
    const data = await this.request(`/api/income/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: incomeData
    });
    return data.income;
  }

  async deleteIncome(id) {
    return await this.request(`/api/income/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  async deleteIncomeMonth(monthKey) {
    return await this.request(`/api/income/month/${encodeURIComponent(monthKey)}`, {
      method: 'DELETE'
    });
  }

  // ============================================================================
  // Categories APIs
  // ============================================================================

  async getCategories() {
    const data = await this.request('/api/categories');
    return data.categories || [];
  }

  async createCategory(categoryData) {
    const data = await this.request('/api/categories', {
      method: 'POST',
      body: categoryData
    });
    return data.category;
  }

  async updateCategory(id, categoryData) {
    const data = await this.request(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: categoryData
    });
    return data.category;
  }

  async deleteCategory(id, force = false) {
    const query = force ? '?force=true' : '';
    return await this.request(`/api/categories/${encodeURIComponent(id)}${query}`, {
      method: 'DELETE'
    });
  }

  // ============================================================================
  // Goals APIs
  // ============================================================================

  async getGoals() {
    const data = await this.request('/api/goals');
    return data.goals || [];
  }

  async createGoal(goalData) {
    const data = await this.request('/api/goals', {
      method: 'POST',
      body: goalData
    });
    return data.goal;
  }

  async updateGoal(id, goalData) {
    const data = await this.request(`/api/goals/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: goalData
    });
    return data.goal;
  }

  async addGoalFunds(id, amount) {
    return await this.request(`/api/goals/${encodeURIComponent(id)}/contribute`, {
      method: 'POST',
      body: { amount }
    });
  }

  async deleteGoal(id) {
    return await this.request(`/api/goals/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  // ============================================================================
  // Profile & Settings APIs
  // ============================================================================

  async getProfile() {
    const data = await this.request('/api/profile');
    return data.profile;
  }

  async updateProfile(profileData) {
    const data = await this.request('/api/profile', {
      method: 'PUT',
      body: profileData
    });
    return data.profile;
  }

  async getSettings() {
    const data = await this.request('/api/profile/settings');
    return data.settings;
  }

  async updateSettings(settingsData) {
    const data = await this.request('/api/profile/settings', {
      method: 'PUT',
      body: settingsData
    });
    return data.settings;
  }

  async deleteAccount(confirmText = 'DELETE') {
    return await this.request('/api/profile/account', {
      method: 'DELETE',
      body: { confirmText }
    });
  }

  // ============================================================================
  // Analytics APIs
  // ============================================================================

  async getKPIs(monthKey) {
    const query = monthKey ? `?month=${encodeURIComponent(monthKey)}` : '';
    return await this.request(`/api/analytics/kpis${query}`);
  }

  async getBudgetAlerts(monthKey) {
    return await this.request(`/api/budgets/alerts/${encodeURIComponent(monthKey)}`);
  }

  async getMailStatus() {
    return await this.request('/api/budgets/mail-status');
  }

  async configureMail(payload) {
    return await this.request('/api/budgets/configure-mail', {
      method: 'POST',
      body: payload
    });
  }

  async checkBudgetAlerts(monthKey) {
    return await this.request('/api/budgets/check-alerts', {
      method: 'POST',
      body: { monthKey }
    });
  }

  async sendTestEmail() {
    return await this.request('/api/budgets/test-email', { method: 'POST' });
  }
}

export const api = new ApiService();
