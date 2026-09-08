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

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const msg = (isJson && data?.error) ? data.error : `HTTP ${res.status}: ${res.statusText}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // ============================================================================
  // Auth APIs
  // ============================================================================

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

  async getMe() {
    if (!this.token) return null;
    try {
      const data = await this.request('/api/auth/me');
      return data.user;
    } catch (err) {
      if (err.status === 401) {
        this.setToken(null);
      }
      return null;
    }
  }

  async logout() {
    try {
      if (this.token) {
        await this.request('/api/auth/logout', { method: 'POST' });
      }
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

  async sendTestEmail() {
    return await this.request('/api/budgets/test-email', { method: 'POST' });
  }
}

export const api = new ApiService();
