/**
 * app.js - Main Application Coordinator
 * Connects Store, UI, Charts, and CSV services with DOM event handlers.
 */

import { store, CATEGORIES, PAYMENT_METHODS } from './store.js';
import { refreshAllCharts, initCharts } from './charts.js';
import { exportExpensesToCSV, parseCSV } from './csv.js';
import { authService } from './auth.js';
import {
  updateDashboardKPIs,
  renderExpenseTable,
  renderModalCategoryPills,
  renderModalPaymentPills,
  openModal,
  closeModal,
  showToast,
  formatCurrency,
  formatMonthName,
  updateAuthUI
} from './ui.js';

class AppController {
  constructor() {
    this.currentEditingId = null;
    this.currentDeleteId = null;
    this.searchQuery = '';
    this.categoryFilter = 'All';
    this.sortOption = 'date-desc';
    this.activeTab = 'expenses';

    this.initTheme();
    initCharts();
    this.initDOM();
    this.initAuth();
    this.initEventListeners();
    this.render();
  }

  initAuth() {
    authService.init();

    // Listen for auth state changes
    authService.onAuthStateChanged((user) => {
      store.setCurrentUser(user);
      updateAuthUI(user, store);
      if (this.activeTab === 'expenses') {
        this.renderTableAndSummary();
      }
    });

    // Try rendering Google Identity Services button if available
    const tryRenderGsi = () => {
      const btnWrapper = document.getElementById('gsiButtonWrapper');
      const divider = document.getElementById('gsiDivider');
      if (btnWrapper && authService.getGoogleClientId()) {
        const rendered = authService.renderGoogleButton(btnWrapper);
        if (rendered && divider) {
          divider.style.display = 'flex';
        }
      }
    };

    if (window.google?.accounts?.id) {
      tryRenderGsi();
    } else {
      window.addEventListener('load', () => {
        setTimeout(tryRenderGsi, 600);
      });
    }
  }

  initTheme() {
    const savedTheme = localStorage.getItem('hisabo_theme_v1') || 'emerald';
    this.setTheme(savedTheme, false);
  }

  setTheme(themeName, persist = true) {
    const allowed = ['emerald', 'midnight', 'amethyst', 'ocean', 'pearl'];
    const activeTheme = allowed.includes(themeName) ? themeName : 'emerald';

    document.documentElement.setAttribute('data-theme', activeTheme);
    if (persist) {
      localStorage.setItem('hisabo_theme_v1', activeTheme);
    }

    const themeLabels = {
      emerald: 'Emerald',
      midnight: 'Midnight',
      amethyst: 'Amethyst',
      ocean: 'Ocean',
      pearl: 'Pearl'
    };

    const labelEl = document.getElementById('themeBtnLabel');
    if (labelEl) {
      labelEl.textContent = themeLabels[activeTheme] || 'Theme';
    }

    // Update active check in theme modal
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.setTheme === activeTheme);
    });

    refreshAllCharts(store);
  }

  initDOM() {
    // Populate hidden native Category selects
    const catFormSelect = document.getElementById('expenseCategory');
    if (catFormSelect) {
      catFormSelect.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
    }

    // Populate hidden native Payment selects
    const payFormSelect = document.getElementById('expensePayment');
    if (payFormSelect) {
      payFormSelect.innerHTML = PAYMENT_METHODS.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
    }

    // Initialize interactive pills with default selections
    renderModalCategoryPills('Food');
    renderModalPaymentPills('UPI');

    // Set default date in expense modal to today
    const dateInput = document.getElementById('expenseDate');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }

  initEventListeners() {
    // Theme Picker Button & Cards
    document.getElementById('themePickerBtn')?.addEventListener('click', () => openModal('themeModal'));

    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.dataset.setTheme;
        this.setTheme(theme);
        const name = card.querySelector('.theme-name')?.innerText.split('(')[0].trim() || theme;
        showToast(`Theme changed to ${name}!`);
      });
    });

    // Navigation Tabs Switcher
    document.querySelectorAll('.view-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const tab = tabBtn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Month Navigation
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => this.shiftMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => this.shiftMonth(1));
    document.getElementById('currentMonthBtn')?.addEventListener('click', () => this.goToCurrentMonth());
    document.getElementById('monthSelect')?.addEventListener('change', (e) => {
      store.setSelectedMonth(e.target.value);
      this.render();
    });

    // Add Expense Trigger
    const addExpenseButtons = document.querySelectorAll('.trigger-add-expense');
    addExpenseButtons.forEach(btn => {
      btn.addEventListener('click', () => this.openAddExpenseModal());
    });

    // Expense Form Submit
    document.getElementById('expenseForm')?.addEventListener('submit', (e) => this.handleExpenseSubmit(e));

    // Modal Close Buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.getAttribute('data-close-modal');
        closeModal(modalId);
      });
    });

    // Close modals on background click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('modal-active');
          document.body.style.overflow = '';
        }
      });
    });

    // Budget Modal
    document.getElementById('editBudgetBtn')?.addEventListener('click', () => this.openBudgetModal());
    document.getElementById('budgetForm')?.addEventListener('submit', (e) => this.handleBudgetSubmit(e));

    // Delete Confirmation
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.handleConfirmDelete());

    // Instant Category Filter Chips
    document.querySelectorAll('#categoryChipsBar .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#categoryChipsBar .chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.categoryFilter = btn.dataset.category;
        this.renderTableAndSummary();
      });
    });

    // Search Controls
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      if (clearSearchBtn) {
        clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
      }
      this.renderTableAndSummary();
    });

    clearSearchBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      this.searchQuery = '';
      clearSearchBtn.style.display = 'none';
      this.renderTableAndSummary();
      searchInput?.focus();
    });

    // Sort Dropdown
    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
      this.sortOption = e.target.value;
      this.renderTableAndSummary();
    });

    // CSV Export & Import
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => this.handleExportCSV());
    document.getElementById('importCsvBtn')?.addEventListener('click', () => openModal('importModal'));
    document.getElementById('csvFileInput')?.addEventListener('change', (e) => this.handleCSVFileSelected(e));

    // Clear Month / All
    document.getElementById('clearDataTriggerBtn')?.addEventListener('click', () => openModal('clearConfirmModal'));
    document.getElementById('confirmClearMonthBtn')?.addEventListener('click', () => {
      store.clearMonthExpenses(store.getSelectedMonth());
      closeModal('clearConfirmModal');
      showToast(`Cleared all expenses for ${formatMonthName(store.getSelectedMonth())}`);
      this.render();
    });
    document.getElementById('confirmClearAllBtn')?.addEventListener('click', () => {
      store.clearAllExpenses();
      closeModal('clearConfirmModal');
      showToast('Cleared all historical expense data');
      this.render();
    });

    // Demo Data
    document.getElementById('loadDemoDataBtn')?.addEventListener('click', () => {
      store.loadDemoData();
      showToast('Loaded realistic demo data successfully!');
      this.render();
      this.switchTab('expenses');
    });

    // ========================================================================
    // Gmail & Google Authentication Event Listeners
    // ========================================================================
    document.getElementById('googleSignInBtn')?.addEventListener('click', () => {
      openModal('authModal');
    });

    document.getElementById('toolsAccountBtn')?.addEventListener('click', () => {
      if (authService.isAuthenticated()) {
        const dropdown = document.getElementById('userProfileDropdown');
        dropdown?.classList.toggle('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        openModal('authModal');
      }
    });

    // User Profile Dropdown Toggle
    const profileBtn = document.getElementById('userProfileBtn');
    const profileDropdown = document.getElementById('userProfileDropdown');
    profileBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = profileDropdown?.classList.toggle('active');
      profileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      const countEl = document.getElementById('dropdownExpenseCount');
      if (countEl) {
        countEl.textContent = store.getUserExpenseCount(authService.getCurrentUser()?.email);
      }
    });

    // Close profile dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (profileDropdown?.classList.contains('active')) {
        if (!profileDropdown.contains(e.target) && !profileBtn?.contains(e.target)) {
          profileDropdown.classList.remove('active');
          profileBtn?.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // Sign Out
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      profileDropdown?.classList.remove('active');
      authService.logout();
      showToast('Signed out of Google Account');
      this.render();
    });

    // Switch Account
    document.getElementById('switchAccountBtn')?.addEventListener('click', () => {
      profileDropdown?.classList.remove('active');
      openModal('authModal');
    });

    // Sync Guest Expenses to Signed-in User
    document.getElementById('syncGuestDataBtn')?.addEventListener('click', () => {
      const user = authService.getCurrentUser();
      if (user) {
        const count = store.migrateGuestDataToUser(user.email);
        profileDropdown?.classList.remove('active');
        if (count > 0) {
          showToast(`Synced ${count} guest expenses to ${user.email}!`);
        } else {
          showToast('All current expenses are already bound to your account.');
        }
        updateAuthUI(user, store);
        this.render();
      }
    });

    // Direct Gmail Sign In Form
    document.getElementById('gmailLoginForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('gmailInput')?.value;
      const name = document.getElementById('gmailNameInput')?.value;
      try {
        const user = authService.loginWithGmail(email, name);
        closeModal('authModal');
        showToast(`Welcome, ${user.givenName || user.name}!`);
        this.render();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // 1-Tap Quick Demo Account Buttons
    document.querySelectorAll('.quick-account-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.dataset.demoEmail;
        const name = btn.dataset.demoName;
        try {
          const user = authService.loginWithGmail(email, name);
          closeModal('authModal');
          showToast(`Signed in as ${user.name}!`);
          this.render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Google Client ID Config Accordion
    const toggleConfigBtn = document.getElementById('toggleClientIdConfigBtn');
    const configBox = document.getElementById('clientIdConfigBox');
    const clientIdInput = document.getElementById('googleClientIdInput');
    const saveClientIdBtn = document.getElementById('saveClientIdBtn');

    toggleConfigBtn?.addEventListener('click', () => {
      if (configBox) {
        const isHidden = configBox.style.display === 'none';
        configBox.style.display = isHidden ? 'block' : 'none';
        if (isHidden && clientIdInput) {
          clientIdInput.value = authService.getGoogleClientId();
          clientIdInput.focus();
        }
      }
    });

    saveClientIdBtn?.addEventListener('click', () => {
      if (clientIdInput) {
        const val = clientIdInput.value.trim();
        authService.setGoogleClientId(val);
        showToast(val ? 'Google Client ID saved!' : 'Google Client ID removed');
        const btnWrapper = document.getElementById('gsiButtonWrapper');
        const divider = document.getElementById('gsiDivider');
        if (btnWrapper && val) {
          const rendered = authService.renderGoogleButton(btnWrapper);
          if (rendered && divider) divider.style.display = 'flex';
        }
      }
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.modal-active').forEach(m => m.classList.remove('modal-active'));
        document.body.style.overflow = '';
      }
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update Tab Buttons
    document.querySelectorAll('.view-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update View Panels
    const views = {
      expenses: document.getElementById('viewExpenses'),
      analytics: document.getElementById('viewAnalytics'),
      tools: document.getElementById('viewTools')
    };

    Object.keys(views).forEach(key => {
      if (views[key]) {
        views[key].classList.toggle('active', key === tabName);
      }
    });

    // Refresh charts if switching to Analytics tab
    if (tabName === 'analytics') {
      setTimeout(() => refreshAllCharts(store), 50);
    }
  }

  shiftMonth(offset) {
    const current = store.getSelectedMonth();
    const [y, m] = current.split('-').map(Number);
    const date = new Date(y, m - 1 + offset, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    store.setSelectedMonth(`${newY}-${newM}`);
    this.render();
  }

  goToCurrentMonth() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    store.setSelectedMonth(`${y}-${m}`);
    this.render();
  }

  updateMonthSelectorUI() {
    const currentMonth = store.getSelectedMonth();
    const displayLabel = document.getElementById('currentMonthDisplay');
    if (displayLabel) {
      displayLabel.textContent = formatMonthName(currentMonth);
    }

    const select = document.getElementById('monthSelect');
    if (select) {
      const distinctMonths = store.getDistinctMonths();
      select.innerHTML = distinctMonths.map(m => {
        return `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${formatMonthName(m)}</option>`;
      }).join('');
    }
  }

  openAddExpenseModal() {
    this.currentEditingId = null;
    document.getElementById('expenseModalTitle').textContent = 'Add New Expense';
    document.getElementById('expenseSubmitBtn').textContent = 'Save Expense';
    document.getElementById('expenseForm').reset();
    
    // Default date to today or current month first day
    const today = new Date().toISOString().split('T')[0];
    const selectedMonth = store.getSelectedMonth();
    const currentRealMonth = today.substring(0, 7);

    const dateInput = document.getElementById('expenseDate');
    if (selectedMonth === currentRealMonth) {
      dateInput.value = today;
    } else {
      dateInput.value = `${selectedMonth}-01`;
    }

    // Default pills: Food and UPI
    renderModalCategoryPills('Food');
    renderModalPaymentPills('UPI');

    openModal('expenseModal');
    setTimeout(() => document.getElementById('expenseAmount')?.focus(), 150);
  }

  openEditExpenseModal(id) {
    const exp = store.getExpenseById(id);
    if (!exp) return;

    this.currentEditingId = id;
    document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
    document.getElementById('expenseSubmitBtn').textContent = 'Update Expense';

    document.getElementById('expenseDate').value = exp.date;
    document.getElementById('expenseItem').value = exp.item;
    document.getElementById('expenseAmount').value = exp.amount;
    document.getElementById('expenseNotes').value = exp.notes || '';

    // Set selected pills
    renderModalCategoryPills(exp.category);
    renderModalPaymentPills(exp.paymentMethod);

    openModal('expenseModal');
    setTimeout(() => document.getElementById('expenseAmount')?.focus(), 150);
  }

  handleExpenseSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const date = form.expenseDate.value;
    const item = form.expenseItem.value.trim();
    const amount = parseFloat(form.expenseAmount.value);
    const category = form.expenseCategory.value || 'Food';
    const paymentMethod = form.expensePayment.value || 'UPI';
    const notes = form.expenseNotes.value.trim();

    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid positive amount in ₹', 'error');
      return;
    }

    if (!item) {
      showToast('Please enter what you purchased', 'error');
      return;
    }

    if (!date) {
      showToast('Please select a valid date', 'error');
      return;
    }

    try {
      if (this.currentEditingId) {
        store.updateExpense(this.currentEditingId, { date, item, amount, category, paymentMethod, notes });
        showToast(`Updated "${item}" (${formatCurrency(amount)})`);
      } else {
        store.addExpense({ date, item, amount, category, paymentMethod, notes });
        showToast(`Saved "${item}" for ${formatCurrency(amount)}`);

        // If expense was added to another month, switch to it
        const expMonth = date.substring(0, 7);
        if (expMonth !== store.getSelectedMonth()) {
          store.setSelectedMonth(expMonth);
        }
      }

      closeModal('expenseModal');
      this.switchTab('expenses'); // Ensure user is on expenses view
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  openBudgetModal() {
    const currentMonth = store.getSelectedMonth();
    const currentBudget = store.getBudget(currentMonth);
    document.getElementById('budgetMonthLabel').textContent = formatMonthName(currentMonth);
    document.getElementById('budgetAmountInput').value = currentBudget;
    openModal('budgetModal');
    setTimeout(() => document.getElementById('budgetAmountInput')?.focus(), 150);
  }

  handleBudgetSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('budgetAmountInput');
    const val = parseFloat(input.value);

    if (isNaN(val) || val < 0) {
      showToast('Please enter a valid positive budget amount', 'error');
      return;
    }

    const currentMonth = store.getSelectedMonth();
    store.setBudget(currentMonth, val);
    closeModal('budgetModal');
    showToast(`Monthly budget updated to ${formatCurrency(val)}`);
    this.render();
  }

  handleDuplicate(id) {
    try {
      const copy = store.duplicateExpense(id);
      showToast(`Duplicated "${copy.item}" with today's date`);
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  handleDeleteRequest(id) {
    const exp = store.getExpenseById(id);
    if (!exp) return;

    this.currentDeleteId = id;
    document.getElementById('deleteItemName').textContent = exp.item;
    document.getElementById('deleteItemAmount').textContent = formatCurrency(exp.amount);
    openModal('deleteConfirmModal');
  }

  handleConfirmDelete() {
    if (!this.currentDeleteId) return;
    const removed = store.deleteExpense(this.currentDeleteId);
    closeModal('deleteConfirmModal');
    if (removed) {
      showToast('Expense deleted successfully');
      this.render();
    }
    this.currentDeleteId = null;
  }

  getFilteredExpenses() {
    const list = store.getExpensesForMonth(store.getSelectedMonth());

    return list.filter(exp => {
      // Search match
      if (this.searchQuery) {
        const itemMatch = exp.item.toLowerCase().includes(this.searchQuery);
        const notesMatch = (exp.notes || '').toLowerCase().includes(this.searchQuery);
        if (!itemMatch && !notesMatch) return false;
      }

      // Category filter chip
      if (this.categoryFilter !== 'All' && exp.category !== this.categoryFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      switch (this.sortOption) {
        case 'date-asc':
          return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
        case 'date-desc':
          return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
        case 'amount-asc':
          return a.amount - b.amount;
        case 'amount-desc':
          return b.amount - a.amount;
        default:
          return b.date.localeCompare(a.date);
      }
    });
  }

  renderTableAndSummary() {
    const filtered = this.getFilteredExpenses();
    renderExpenseTable(
      filtered,
      (id) => this.openEditExpenseModal(id),
      (id) => this.handleDuplicate(id),
      (id) => this.handleDeleteRequest(id)
    );
  }

  handleExportCSV() {
    const currentMonth = store.getSelectedMonth();
    const list = store.getExpensesForMonth(currentMonth);

    if (list.length === 0) {
      showToast('No expenses found for this month to export', 'error');
      return;
    }

    try {
      const filename = `expenses_${currentMonth}.csv`;
      exportExpensesToCSV(list, filename);
      showToast(`Exported ${list.length} expenses to ${filename}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  handleCSVFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const result = parseCSV(text);

        if (result.errors.length > 0) {
          const previewErrors = result.errors.slice(0, 3).join(', ');
          showToast(`Import warnings: ${previewErrors}`, 'error');
        }

        if (result.validExpenses.length > 0) {
          result.validExpenses.forEach(exp => {
            store.addExpense(exp);
          });

          showToast(`Successfully imported ${result.validExpenses.length} expense${result.validExpenses.length === 1 ? '' : 's'}!`);
          closeModal('importModal');
          this.switchTab('expenses');
          this.render();
        } else {
          showToast('No valid expenses found in CSV file', 'error');
        }
      } catch (err) {
        showToast(`Failed to parse CSV: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  render() {
    this.updateMonthSelectorUI();
    const kpis = store.getMonthKPIs(store.getSelectedMonth());
    updateDashboardKPIs(kpis);
    updateAuthUI(authService.getCurrentUser(), store);
    this.renderTableAndSummary();
    if (this.activeTab === 'analytics') {
      refreshAllCharts(store);
    }
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
