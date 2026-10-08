/**
 * app.js - Main Application Coordinator (Design #7 Fintech System)
 * Manages routing, route protection, real authentication, store synchronization,
 * chart rendering, modals, and user interactions across all 11 core application views.
 */

import { store, CATEGORIES, PAYMENT_METHODS } from './store.js?v=3.2';
import { refreshAllCharts, renderSpendingTrendChart, renderAnalyticsCharts, initCharts } from './charts.js?v=3.2';
import { authService } from './auth.js?v=3.2';
import { api } from './api.js?v=3.2';
import { exportExpensesToCSV, parseCSV } from './csv.js?v=3.2';
import {
  formatCurrency,
  formatDate,
  formatMonthName,
  updateDashboardKPIs,
  renderTransactionsTable,
  renderIncomeView,
  renderBudgetView,
  renderCategoriesView,
  renderCalendarView,
  renderCalendarSelectedDay,
  renderAnalyticsView,
  renderGoalsView,
  renderProfileView,
  renderSettingsView,
  updateAuthUI,
  openModal,
  closeModal,
  showToast,
  getCategoryBadge,
  getPaymentBadge,
  ICONS
} from './ui.js?v=3.2';

class HisaaboApp {
  constructor() {
    this.currentRoute = 'dashboard';
    this.activeSpendingPeriod = 'monthly';
    this.txFilters = {
      typeFilter: 'all',
      categoryFilter: 'All',
      paymentFilter: 'All',
      sortOption: 'date-desc',
      searchQuery: '',
      currentPage: 1,
      pageSize: 10
    };
    this.pendingDeleteAction = null;
    this.editingExpenseId = null;
    this.editingIncomeId = null;

    this.init();
  }

  async init() {
    try {
      initCharts();
      this.initTheme();
      this.initAuth();
      this.initEventListeners();
      this.handleRouting();
      window.addEventListener('hashchange', () => this.handleRouting());
    } catch (err) {
      console.error('[HisaaboApp] Init error:', err);
    }
  }

  /* --------------------------------------------------------------------------
     THEME & APPEARANCE
     -------------------------------------------------------------------------- */
  initTheme() {
    const savedTheme = localStorage.getItem('hisabo_theme_v7') || 'midnight';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = savedTheme;
  }

  setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('hisabo_theme_v7', themeName);
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = themeName;
    refreshAllCharts(store, this.activeSpendingPeriod);
  }

  /* --------------------------------------------------------------------------
     AUTHENTICATION & ACCESS CONTROL
     -------------------------------------------------------------------------- */
  initAuth() {
    authService.init();

    authService.onAuthStateChanged(async (user) => {
      if (user) {
        updateAuthUI(user);
        try {
          await store.loadFromDatabase();
        } catch (e) {
          console.warn('[HisaaboApp] Database load error:', e);
        }
        this.updateMonthSelectorDisplay();
        this.handleRouting();
        this.renderCurrentView();
      } else {
        store.resetState();
        this.handleRouting();
      }
    });

    // Render Google Identity Services button if available
    setTimeout(() => {
      const gsiWrapper = document.getElementById('gsiButtonWrapper');
      if (gsiWrapper && authService.getGoogleClientId()) {
        authService.renderGoogleButton(gsiWrapper);
      }
    }, 500);
  }

  /* --------------------------------------------------------------------------
     ROUTER & ROUTE PROTECTION (Sections 2 & 6)
     -------------------------------------------------------------------------- */
  handleRouting() {
    const hash = window.location.hash.replace('#', '') || 'home';
    const isAuthed = authService.isAuthenticated();

    const protectedRoutes = [
      'dashboard', 'transactions', 'add-expense', 'income',
      'budget', 'categories', 'calendar', 'analytics',
      'goals', 'profile', 'settings'
    ];

    const landingContainer = document.getElementById('landingPage');
    const appLayout = document.getElementById('appLayout');

    // Route Protection: Redirect unauthenticated requests to sign in
    if (protectedRoutes.includes(hash) && !isAuthed) {
      if (landingContainer) landingContainer.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'none';
      this.setAuthModalMode('login');
      openModal('authModal');
      return;
    }

    // Authenticated users redirected from signin/signup/home to dashboard
    if (isAuthed && (hash === 'home' || hash === 'signin' || hash === 'signup' || hash === '')) {
      window.location.hash = '#dashboard';
      return;
    }

    if (hash === 'signin') {
      if (landingContainer) landingContainer.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'none';
      this.setAuthModalMode('login');
      openModal('authModal');
      return;
    }

    if (hash === 'signup') {
      if (landingContainer) landingContainer.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'none';
      this.setAuthModalMode('signup');
      openModal('authModal');
      return;
    }

    if (!isAuthed) {
      // Show unauthenticated landing page
      if (landingContainer) landingContainer.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'none';
      return;
    }

    // Authenticated view active
    if (landingContainer) landingContainer.style.display = 'none';
    if (appLayout) appLayout.style.display = 'flex';

    this.currentRoute = protectedRoutes.includes(hash) ? hash : 'dashboard';
    this.activateView(this.currentRoute);
  }

  activateView(routeId) {
    // Update sidebar navigation active links
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      const r = item.getAttribute('data-route');
      item.classList.toggle('active', r === routeId);
    });

    // Switch view containers
    document.querySelectorAll('.route-view-content').forEach(view => {
      view.classList.remove('active');
    });

    const viewElMap = {
      dashboard: 'viewDashboard',
      transactions: 'viewTransactions',
      'add-expense': 'viewAddExpense',
      income: 'viewIncome',
      budget: 'viewBudget',
      categories: 'viewCategories',
      calendar: 'viewCalendar',
      analytics: 'viewAnalytics',
      goals: 'viewGoals',
      profile: 'viewProfile',
      settings: 'viewSettings'
    };

    const targetEl = document.getElementById(viewElMap[routeId]);
    if (targetEl) {
      targetEl.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Close mobile drawer if open
    this.closeMobileSidebar();

    // Render active view
    this.renderCurrentView();
  }

  renderCurrentView() {
    const monthKey = store.getSelectedMonth();
    this.updateMonthSelectorDisplay();

    switch (this.currentRoute) {
      case 'dashboard':
        updateDashboardKPIs(monthKey);
        refreshAllCharts(store, this.activeSpendingPeriod);
        break;
      case 'transactions':
        renderTransactionsTable({ ...this.txFilters, monthKey });
        this.populateTxCategoryFilter();
        break;
      case 'add-expense': {
        const pageDate = document.getElementById('pageExpDate');
        if (pageDate && !pageDate.value) pageDate.value = new Date().toISOString().split('T')[0];
        this.renderPills('pageExpCategoryPills', 'pageExpPaymentPills', 'pageExpCategoryHidden', 'pageExpPaymentHidden');
        break;
      }
      case 'income':
        renderIncomeView(monthKey);
        break;
      case 'budget':
        renderBudgetView(monthKey);
        break;
      case 'categories':
        renderCategoriesView();
        break;
      case 'calendar':
        renderCalendarView(monthKey);
        break;
      case 'analytics':
        renderAnalyticsView(monthKey);
        renderAnalyticsCharts(store);
        break;
      case 'goals':
        renderGoalsView();
        break;
      case 'profile':
        renderProfileView();
        break;
      case 'settings':
        renderSettingsView();
        break;
    }
  }

  /* --------------------------------------------------------------------------
     MONTH SELECTOR
     -------------------------------------------------------------------------- */
  updateMonthSelectorDisplay() {
    const monthKey = store.getSelectedMonth();
    const formatted = formatMonthName(monthKey);
    const displayEl = document.getElementById('currentMonthDisplay');
    if (displayEl) displayEl.textContent = formatted;

    const selectEl = document.getElementById('monthSelect');
    if (selectEl) {
      // Populate last 12 months if empty
      if (selectEl.options.length === 0) {
        const [currY, currM] = monthKey.split('-').map(Number);
        for (let i = 0; i < 12; i++) {
          const d = new Date(currY, currM - 1 - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = formatMonthName(key);
          selectEl.appendChild(opt);
        }
      }
      selectEl.value = monthKey;
    }
  }

  changeMonth(delta) {
    const current = store.getSelectedMonth();
    const [y, m] = current.split('-').map(Number);
    const nextDate = new Date(y, m - 1 + delta, 1);
    const newMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    store.setSelectedMonth(newMonthKey);
    this.renderCurrentView();
  }

  /* --------------------------------------------------------------------------
     MODAL CONTROLS & PILLS
     -------------------------------------------------------------------------- */
  setAuthModalMode(mode = 'login') {
    this.authModalMode = mode;
    const isLogin = mode === 'login';
    const loginView = document.getElementById('authLoginView');
    const signupView = document.getElementById('authSignupView');
    const loginForm = document.getElementById('authLoginForm');
    const signupForm = document.getElementById('authSignupForm');
    const tabLogin = document.getElementById('authTabLogin');
    const tabSignup = document.getElementById('authTabSignup');
    const title = document.getElementById('authModalTitle');
    const subtitle = document.getElementById('authModalSubtitle');
    const errorAlert = document.getElementById('authErrorAlert');
    const successAlert = document.getElementById('authSuccessAlert');
    const googleBtnText = document.querySelector('#continueWithGoogleBtn span');
    const authDividerText = document.querySelector('.gsi-container .auth-divider span');

    if (errorAlert) {
      errorAlert.style.display = 'none';
      errorAlert.textContent = '';
    }
    if (successAlert) {
      successAlert.style.display = 'none';
      successAlert.textContent = '';
    }

    if (loginView) {
      loginView.classList.toggle('active', isLogin);
      loginView.style.display = isLogin ? 'block' : 'none';
    }
    if (signupView) {
      signupView.classList.toggle('active', !isLogin);
      signupView.style.display = isLogin ? 'none' : 'block';
    }

    if (loginForm) loginForm.style.display = isLogin ? 'block' : 'none';
    if (signupForm) signupForm.style.display = isLogin ? 'none' : 'block';

    if (tabLogin) tabLogin.classList.toggle('active', isLogin);
    if (tabSignup) tabSignup.classList.toggle('active', !isLogin);

    if (title) title.textContent = isLogin ? 'Sign In to Hisaabo' : 'Create Your Hisaabo Account';
    if (subtitle) subtitle.textContent = isLogin ? 'Welcome back! Enter your credentials to access your financial dashboard.' : 'Start your journey to financial freedom in under 30 seconds.';

    if (googleBtnText) {
      googleBtnText.textContent = isLogin ? 'Sign In with Google' : 'Sign Up with Google';
    }
    if (authDividerText) {
      authDividerText.textContent = isLogin ? 'OR CONTINUE WITH EMAIL' : 'OR SIGN UP WITH EMAIL';
    }
  }

  configureGoogleAccountModal(mode = 'login', prefillEmail = '', prefillName = '') {
    const isLogin = mode === 'login';
    const titleEl = document.getElementById('googleModalTitle');
    const subEl = document.getElementById('googleModalSubtitle');
    const submitBtn = document.getElementById('googleCustomSubmitBtn');
    const badge1 = document.getElementById('googleBadge1');
    const badge2 = document.getElementById('googleBadge2');
    const emailInput = document.getElementById('googleCustomEmailInput');
    const nameInput = document.getElementById('googleCustomNameInput');

    if (titleEl) titleEl.textContent = isLogin ? 'Sign in with Google' : 'Sign up with Google';
    if (subEl) subEl.textContent = isLogin ? 'Choose an account to continue to Hisaabo' : 'Choose or enter your Google account to create your Hisaabo profile';
    if (submitBtn) submitBtn.textContent = isLogin ? 'Sign In with Google' : 'Sign Up with Google';
    if (badge1) badge1.textContent = isLogin ? 'One-Tap' : 'Sign Up';
    if (badge2) badge2.textContent = isLogin ? 'One-Tap' : 'Sign Up';

    if (emailInput && prefillEmail) emailInput.value = prefillEmail;
    if (nameInput && prefillName) nameInput.value = prefillName;
  }

  renderPills(catContainerId, payContainerId, hiddenCatId, hiddenPayId) {
    const catContainer = document.getElementById(catContainerId);
    const payContainer = document.getElementById(payContainerId);
    const hiddenCat = document.getElementById(hiddenCatId);
    const hiddenPay = document.getElementById(hiddenPayId);

    const categories = store.getCategories ? store.getCategories() : CATEGORIES;

    if (catContainer) {
      const activeCat = hiddenCat?.value || 'Food';
      catContainer.innerHTML = categories.map(c => {
        const catLabel = c.label || c.name || c.id;
        const iconSvg = ICONS[c.icon] || ICONS['more-horizontal'] || '';
        return `
          <button type="button" class="quick-cat-chip ${c.id === activeCat ? 'active' : ''}" data-cat="${c.id}" title="${catLabel}">
            <span class="quick-cat-icon">${iconSvg}</span>
            <span class="quick-cat-label">${catLabel}</span>
          </button>
        `;
      }).join('');

      catContainer.querySelectorAll('.quick-cat-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          catContainer.querySelectorAll('.quick-cat-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (hiddenCat) hiddenCat.value = btn.dataset.cat;
        });
      });
    }

    if (payContainer) {
      const activePay = hiddenPay?.value || 'UPI';
      payContainer.innerHTML = PAYMENT_METHODS.map(p => {
        const payLabel = p.label || p.name || p.id;
        const iconSvg = ICONS[p.icon] || ICONS.wallet || '';
        return `
          <button type="button" class="payment-method-chip ${p.id === activePay ? 'active' : ''}" data-pay="${p.id}">
            ${iconSvg}
            <span>${payLabel}</span>
          </button>
        `;
      }).join('');

      payContainer.querySelectorAll('.payment-method-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          payContainer.querySelectorAll('.payment-method-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (hiddenPay) hiddenPay.value = btn.dataset.pay;
        });
      });
    }
  }

  populateTxCategoryFilter() {
    const select = document.getElementById('txFilterCategory');
    if (!select || select.dataset.populated) return;

    const categories = store.getCategories ? store.getCategories() : CATEGORIES;
    select.innerHTML = '<option value="All">All Categories</option>' +
      categories.map(c => {
        const label = c.label || c.name || c.id;
        return `<option value="${c.id}">${label}</option>`;
      }).join('');
    select.dataset.populated = 'true';
  }

  /* --------------------------------------------------------------------------
     EVENT LISTENERS & BINDINGS
     -------------------------------------------------------------------------- */
  initEventListeners() {
    // Landing Page CTAs & Modal Triggers
    document.getElementById('landingSignInBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setAuthModalMode('login');
      openModal('authModal');
    });
    document.getElementById('landingGetStartedBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setAuthModalMode('signup');
      openModal('authModal');
    });
    document.getElementById('heroGetStartedBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setAuthModalMode('signup');
      openModal('authModal');
    });
    document.getElementById('footerGetStartedBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.setAuthModalMode('signup');
      openModal('authModal');
    });
    document.getElementById('heroWatchDemoBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const showcase = document.getElementById('preview');
      if (showcase) showcase.scrollIntoView({ behavior: 'smooth' });
    });

    // Landing Page Navigation Smooth Scroll
    document.querySelectorAll('.landing-link, .brand-badge-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          const targetId = href.replace('#', '');
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    // Auth Modal Tabs & In-Form Switches
    document.getElementById('authTabLogin')?.addEventListener('click', () => this.setAuthModalMode('login'));
    document.getElementById('authTabSignup')?.addEventListener('click', () => this.setAuthModalMode('signup'));
    document.getElementById('signupToSignInBtn')?.addEventListener('click', () => this.setAuthModalMode('login'));
    document.getElementById('loginToSignUpBtn')?.addEventListener('click', () => this.setAuthModalMode('signup'));

    // Forgot Password Link Trigger
    document.getElementById('loginForgotPasswordLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal('authModal');
      openModal('forgotPasswordModal');
    });

    // Password Visibility Eye Toggle Buttons
    document.querySelectorAll('.btn-toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        if (input && (input.type === 'password' || input.type === 'text')) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.textContent = isPassword ? '🙈' : '👁️';
        }
      });
    });

    // Auth Forms Submit
    document.getElementById('authLoginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('authSignupForm')?.addEventListener('submit', (e) => this.handleSignup(e));
    document.getElementById('continueWithGoogleBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const googleBtn = document.getElementById('continueWithGoogleBtn');
      const origHtml = googleBtn ? googleBtn.innerHTML : '';
      try {
        if (googleBtn) {
          googleBtn.disabled = true;
          googleBtn.innerHTML = '<span>Connecting to Google...</span>';
        }

        const currentMode = this.authModalMode || (document.getElementById('authSignupView')?.style.display !== 'none' ? 'signup' : 'login');
        const signupEmail = document.getElementById('signupGmailInput')?.value?.trim();
        const signupName = document.getElementById('signupNameInput')?.value?.trim();
        const loginEmail = document.getElementById('loginGmailInput')?.value?.trim();

        // If user already typed their email in signup form, sign up directly via Google
        if (currentMode === 'signup' && signupEmail && authService.validateEmail(signupEmail)) {
          await handleQuickGoogleSignIn(signupEmail, signupName || signupEmail.split('@')[0]);
          return;
        }

        // If user already typed their email in login form, sign in directly via Google
        if (currentMode === 'login' && loginEmail && authService.validateEmail(loginEmail)) {
          await handleQuickGoogleSignIn(loginEmail, loginEmail.split('@')[0]);
          return;
        }

        const action = await authService.triggerGoogleLogin();
        if (action === 'open_selector') {
          this.configureGoogleAccountModal(currentMode, signupEmail || loginEmail, signupName);
          closeModal('authModal');
          openModal('googleAccountModal');
        }
      } catch (err) {
        showToast(err.message || 'Google authentication failed.', 'error');
      } finally {
        if (googleBtn) {
          googleBtn.disabled = false;
          googleBtn.innerHTML = origHtml;
        }
      }
    });

    // Quick Google Account Selection
    const handleQuickGoogleSignIn = async (email, name) => {
      try {
        showToast(`Connecting with Google (${email})...`, 'info');
        await authService.loginWithGooglePayload({ email, name });
        showToast(`Welcome to Hisaabo, ${name}!`, 'success');
        closeModal('googleAccountModal');
        closeModal('authModal');
        this.renderUserHeader();
        window.location.hash = '#dashboard';
        this.handleRouting();
        if (typeof this.renderCurrentView === 'function') {
          this.renderCurrentView();
        }
      } catch (err) {
        const errEl = document.getElementById('googleAuthError');
        if (errEl) {
          errEl.textContent = err.message || 'Google sign in failed.';
          errEl.style.display = 'block';
        }
        showToast(err.message || 'Google sign in failed.', 'error');
      }
    };

    document.getElementById('googleQuickAccountBtn1')?.addEventListener('click', (e) => {
      e.preventDefault();
      handleQuickGoogleSignIn('dishusony@gmail.com', 'Disha Sony');
    });

    document.getElementById('googleQuickAccountBtn2')?.addEventListener('click', (e) => {
      e.preventDefault();
      handleQuickGoogleSignIn('student.user@gmail.com', 'Student Learner');
    });

    document.getElementById('googleCustomAccountForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('googleCustomEmailInput');
      const nameInput = document.getElementById('googleCustomNameInput');
      const email = emailInput?.value || '';
      const name = nameInput?.value || email.split('@')[0];
      if (!email) {
        showToast('Please enter your Google / Gmail address.', 'error');
        return;
      }
      await handleQuickGoogleSignIn(email, name);
    });

    // Sidebar & Mobile Navigation
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => this.openMobileSidebar());
    document.getElementById('sidebarCloseBtn')?.addEventListener('click', () => this.closeMobileSidebar());
    document.getElementById('sidebarBackdrop')?.addEventListener('click', () => this.closeMobileSidebar());
    document.getElementById('sidebarLogoutBtn')?.addEventListener('click', () => this.handleLogout());

    // Month Selector Buttons
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => this.changeMonth(1));
    document.getElementById('currentMonthBtn')?.addEventListener('click', () => {
      store.resetToCurrentMonth();
      this.renderCurrentView();
    });
    document.getElementById('monthSelect')?.addEventListener('change', (e) => {
      store.setSelectedMonth(e.target.value);
      this.renderCurrentView();
    });

    // Global Search
    const searchInput = document.getElementById('globalSearchInput');
    const clearSearch = document.getElementById('clearGlobalSearchBtn');
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value;
      if (clearSearch) clearSearch.style.display = q ? 'block' : 'none';
      this.txFilters.searchQuery = q;
      if (this.currentRoute === 'transactions') {
        renderTransactionsTable({ ...this.txFilters, monthKey: store.getSelectedMonth() });
      }
    });
    clearSearch?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearSearch.style.display = 'none';
      this.txFilters.searchQuery = '';
      if (this.currentRoute === 'transactions') {
        renderTransactionsTable({ ...this.txFilters, monthKey: store.getSelectedMonth() });
      }
    });

    // Spending Chart Period Toggles (Weekly / Monthly / Yearly)
    document.querySelectorAll('.btn-period-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-period-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeSpendingPeriod = btn.getAttribute('data-period') || 'monthly';
        renderSpendingTrendChart('spendingTrendChart', store, this.activeSpendingPeriod);
      });
    });

    // Quick Add Expense triggers
    const openAddExpenseModal = () => {
      this.editingExpenseId = null;
      const titleEl = document.getElementById('expenseModalTitle');
      if (titleEl) titleEl.textContent = 'Add New Expense';
      const form = document.getElementById('modalExpenseForm');
      if (form) form.reset();
      const dateInput = document.getElementById('modalExpDate');
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      this.renderPills('modalCategoryPills', 'modalPaymentPills', 'modalExpCategoryHidden', 'modalExpPaymentHidden');
      openModal('expenseModal');
    };
    document.getElementById('topbarAddExpenseBtn')?.addEventListener('click', openAddExpenseModal);
    document.querySelectorAll('.trigger-add-expense').forEach(btn => {
      btn.addEventListener('click', openAddExpenseModal);
    });

    // Quick Add Income / Pocket Money triggers
    document.querySelectorAll('.trigger-add-income').forEach(btn => {
      btn.addEventListener('click', () => {
        this.editingIncomeId = null;
        const titleEl = document.getElementById('incomeModalTitle');
        if (titleEl) titleEl.textContent = 'Add Budget / Pocket Money';
        const form = document.getElementById('incomeForm');
        if (form) form.reset();
        const dateInput = document.getElementById('incomeDate') || document.getElementById('incomeDateInput');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        openModal('incomeModal');
      });
    });

    // Budget trigger
    const openBudgetModalHandler = () => {
      const monthKey = store.getSelectedMonth();
      const kpis = store.getMonthKPIs(monthKey);
      const input = document.getElementById('overallBudgetLimitInput') || document.getElementById('budgetAmountInput');
      if (input) input.value = kpis.budget;
      const monthLabel = document.getElementById('budgetMonthLabel');
      if (monthLabel && typeof formatMonthName === 'function') {
        monthLabel.textContent = formatMonthName(monthKey);
      }
      openModal('budgetModal');
      setTimeout(() => input?.focus(), 50);
    };

    document.getElementById('editBudgetTriggerBtn')?.addEventListener('click', openBudgetModalHandler);
    document.getElementById('budgetOpenOverallModalBtn')?.addEventListener('click', openBudgetModalHandler);
    document.querySelectorAll('.trigger-edit-budget, [data-open-modal="budgetModal"]').forEach(btn => {
      btn.addEventListener('click', openBudgetModalHandler);
    });

    // Universal delegation for all budget edit triggers
    document.addEventListener('click', (e) => {
      const budgetBtn = e.target.closest('#budgetOpenOverallModalBtn, #editBudgetTriggerBtn, .trigger-edit-budget, [data-open-modal="budgetModal"]');
      if (budgetBtn) {
        e.preventDefault();
        openBudgetModalHandler();
      }
      const mailBtn = e.target.closest('#configureMailBtn');
      if (mailBtn) {
        e.preventDefault();
        openModal('mailConfigModal');
      }
    });

    // Add Category Budget Trigger
    document.querySelectorAll('.trigger-add-category-budget, #addCategoryBudgetBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const select = document.getElementById('catBudgetCategorySelect') || document.getElementById('catBudgetSelect');
        if (select) {
          const cats = store.getCategories ? store.getCategories() : CATEGORIES;
          select.innerHTML = cats.map(c => {
            const label = c.label || c.name || c.id;
            return `<option value="${c.id}">${label}</option>`;
          }).join('');
        }
        openModal('categoryBudgetModal');
      });
    });

    // Add Custom Category Trigger
    document.getElementById('openAddCategoryModalBtn')?.addEventListener('click', () => {
      const form = document.getElementById('customCategoryForm');
      if (form) form.reset();
      openModal('customCategoryModal');
    });

    // Add Goal Trigger
    document.getElementById('openAddGoalModalBtn')?.addEventListener('click', () => {
      const form = document.getElementById('goalForm');
      if (form) form.reset();
      openModal('goalModal');
    });

    // Notification Bell Toggle
    const notifBell = document.getElementById('notifBellBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    notifBell?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (notifDropdown) {
        notifDropdown.style.display = notifDropdown.style.display === 'none' ? 'block' : 'none';
      }
    });
    document.addEventListener('click', (e) => {
      if (notifDropdown && !notifDropdown.contains(e.target) && e.target !== notifBell) {
        notifDropdown.style.display = 'none';
      }
    });

    // Modal Close Buttons (supports .modal-close-btn, .modal-cancel-btn, [data-close-modal])
    document.querySelectorAll('.modal-close-btn, .modal-cancel-btn, [data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetModalId = btn.getAttribute('data-close-modal');
        if (targetModalId) {
          closeModal(targetModalId);
        } else {
          const modal = btn.closest('.modal-backdrop') || btn.closest('.modal-backdrop-fintech');
          if (modal && modal.id) closeModal(modal.id);
        }
      });
    });

    // Dismiss modal on backdrop background click (outside dialog content)
    document.querySelectorAll('.modal-backdrop, .modal-backdrop-fintech').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop && backdrop.id) {
          closeModal(backdrop.id);
        }
      });
    });

    // Dismiss modal on Escape key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-backdrop.active, .modal-backdrop-fintech.active, .modal-backdrop[style*="display: flex"]');
        if (activeModal && activeModal.id) {
          closeModal(activeModal.id);
        }
      }
    });

    // Clear Notifications Button
    document.getElementById('clearNotifsBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const list = document.getElementById('notifList');
      if (list) list.innerHTML = '<div class="notif-empty">No active notifications</div>';
      const badge = document.getElementById('notifBadge');
      if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
      }
      showToast('Notifications cleared.', 'info');
    });

    // Offline Banner Retry Button
    document.getElementById('networkRetryBtn')?.addEventListener('click', async () => {
      showToast('Syncing offline data...', 'info');
      try {
        if (typeof store.syncOfflineQueue === 'function') {
          await store.syncOfflineQueue();
        }
        const banner = document.getElementById('networkStatusBanner');
        if (banner) banner.classList.add('hidden');
        showToast('Sync complete!', 'success');
      } catch (err) {
        showToast('Sync failed: ' + (err.message || 'Still offline'), 'error');
      }
    });

    // Cancel Add-Expense Page
    document.getElementById('pageExpCancelBtn')?.addEventListener('click', () => {
      window.location.hash = '#dashboard';
    });

    // Configure Gmail Alerts Modal Trigger
    document.getElementById('configureMailBtn')?.addEventListener('click', () => {
      openModal('mailConfigModal');
    });

    // Settings CSV & Demo Records Tools
    document.getElementById('settingsExportCsvBtn')?.addEventListener('click', () => {
      try {
        const expenses = store.getAllExpenses();
        if (!expenses || expenses.length === 0) {
          showToast('No expense records available to export.', 'info');
          return;
        }
        exportExpensesToCSV(expenses, `hisabo_expenses_${store.getSelectedMonth()}.csv`);
        showToast('Expenses exported to CSV successfully.', 'success');
      } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
      }
    });

    document.getElementById('settingsImportCsvBtn')?.addEventListener('click', () => {
      openModal('importModal');
    });

    document.getElementById('csvFileInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        showToast('Importing CSV records...', 'info');
        const text = await file.text();
        const parsed = parseCSV(text);
        if (!parsed || parsed.length === 0) {
          showToast('No valid expense records found in CSV.', 'error');
          return;
        }

        let imported = 0;
        for (const exp of parsed) {
          try {
            await store.addExpense(exp);
            imported++;
          } catch (itemErr) {
            console.warn('[CSV Import] Skipped invalid row:', itemErr);
          }
        }
        showToast(`Imported ${imported} expenses successfully!`, 'success');
        closeModal('importModal');
        e.target.value = '';
        this.renderCurrentView();
      } catch (err) {
        showToast('Import failed: ' + (err.message || 'Invalid CSV format.'), 'error');
      }
    });

    document.getElementById('settingsReloadDemoBtn')?.addEventListener('click', () => {
      this.confirmDeletion('Load sample demo records into your tracker?', async () => {
        try {
          await store.loadDemoData();
          showToast('Demo records loaded successfully!', 'success');
          this.renderCurrentView();
        } catch (err) {
          showToast('Failed to load demo records: ' + err.message, 'error');
        }
      });
    });

    // Settings Theme Choice Buttons
    document.querySelectorAll('.theme-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-set-theme');
        if (t) {
          this.setTheme(t);
          document.querySelectorAll('.theme-choice-btn').forEach(b => b.classList.toggle('active', b === btn));
          showToast(`Theme updated to ${btn.textContent.trim()}.`, 'info');
        }
      });
    });

    // Settings Currency Select
    document.getElementById('settingsCurrencySelect')?.addEventListener('change', async (e) => {
      const currency = e.target.value;
      try {
        await api.updateSettings({ currency });
        showToast(`Currency format updated to ${currency}.`, 'success');
      } catch (err) {
        showToast('Failed to update currency: ' + err.message, 'error');
      }
    });

    // Custom Category Color Swatches
    document.querySelectorAll('#customCatColorSwatches .color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('#customCatColorSwatches .color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const hidden = document.getElementById('customCatColorHidden');
        if (hidden) hidden.value = swatch.getAttribute('data-color') || '#00f0ff';
      });
    });

    // Form Submissions
    this.initFormHandlers();

    // Transactions Table Filter Buttons
    document.querySelectorAll('.tx-type-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tx-type-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.txFilters.typeFilter = btn.getAttribute('data-type-filter') || 'all';
        this.txFilters.currentPage = 1;
        renderTransactionsTable({ ...this.txFilters, monthKey: store.getSelectedMonth() });
      });
    });

    document.getElementById('txFilterCategory')?.addEventListener('change', (e) => {
      this.txFilters.categoryFilter = e.target.value;
      this.txFilters.currentPage = 1;
      renderTransactionsTable({ ...this.txFilters, monthKey: store.getSelectedMonth() });
    });

    document.getElementById('txFilterPayment')?.addEventListener('change', (e) => {
      this.txFilters.paymentFilter = e.target.value;
      this.txFilters.currentPage = 1;
      renderTransactionsTable({ ...this.txFilters, monthKey: store.getSelectedMonth() });
    });

    document.getElementById('txSortSelect')?.addEventListener('change', (e) => {
      this.txFilters.sortOption = e.target.value;
      this.txFilters.currentPage = 1;
      renderTransactionsTable({ ...this.txFilters, monthKey: store.getSelectedMonth() });
    });

    // Transaction Pagination Controls
    document.getElementById('txPrevPageBtn')?.addEventListener('click', () => {
      if (this.txFilters.currentPage > 1) {
        this.txFilters.currentPage--;
        renderTransactionsTable({ ...this.txFilters, monthKey: store.getSelectedMonth() });
      }
    });

    document.getElementById('txNextPageBtn')?.addEventListener('click', () => {
      this.txFilters.currentPage++;
      renderTransactionsTable({ ...this.txFilters, monthKey: store.getSelectedMonth() });
    });

    // Calendar Day Click Handler (Supports #calendarDaysGrid and #calendarGrid)
    const handleCalendarClick = (e) => {
      const cell = e.target.closest('.calendar-day-cell');
      if (cell && cell.dataset.date) {
        document.querySelectorAll('.calendar-day-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        renderCalendarSelectedDay(cell.dataset.date);
      }
    };
    document.getElementById('calendarDaysGrid')?.addEventListener('click', handleCalendarClick);
    document.getElementById('calendarGrid')?.addEventListener('click', handleCalendarClick);
  }

  /* --------------------------------------------------------------------------
     FORM SUBMISSIONS (Expense, Income, Budgets, Goals, etc.)
     -------------------------------------------------------------------------- */
  initFormHandlers() {
    // 1. Modal Expense Form
    const handleModalExpenseSubmit = async (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const amountInput = document.getElementById('modalExpAmount');
      const itemInput = document.getElementById('modalExpItem');
      const dateInput = document.getElementById('modalExpDate');

      const amount = parseFloat(amountInput?.value) || 0;
      const title = itemInput?.value?.trim() || '';
      const date = dateInput?.value || new Date().toISOString().split('T')[0];
      const category = document.getElementById('modalExpCategoryHidden')?.value || 'Food';
      const paymentMethod = document.getElementById('modalExpPaymentHidden')?.value || 'UPI';
      const notes = document.getElementById('modalExpNotes')?.value?.trim() || '';

      if (amount <= 0) {
        showToast('Please enter a valid expense amount greater than 0.', 'error');
        amountInput?.focus();
        return;
      }
      if (!title) {
        showToast('Please enter what you bought (item description).', 'error');
        itemInput?.focus();
        return;
      }

      try {
        const payload = {
          item: title,
          title,
          amount,
          date,
          category,
          paymentMethod,
          notes
        };

        if (this.editingExpenseId) {
          await store.updateExpense(this.editingExpenseId, payload);
          showToast('Expense updated successfully.', 'success');
        } else {
          await store.addExpense(payload);
          showToast('Expense added successfully.', 'success');
        }
        closeModal('expenseModal');
        try {
          this.renderCurrentView();
        } catch (renderErr) {
          console.warn('[Hisaabo] View render warning:', renderErr);
        }
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    };

    const modalExpForm = document.getElementById('modalExpenseForm');
    modalExpForm?.addEventListener('submit', handleModalExpenseSubmit);
    document.getElementById('saveExpenseModalBtn')?.addEventListener('click', (e) => {
      if (modalExpForm && !modalExpForm.checkValidity()) {
        modalExpForm.reportValidity();
      }
    });

    // 2. Dedicated Page Expense Form
    document.getElementById('pageExpenseForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountInput = document.getElementById('pageExpAmount');
      const itemInput = document.getElementById('pageExpItem');
      const dateInput = document.getElementById('pageExpDate');

      const amount = parseFloat(amountInput?.value) || 0;
      const title = itemInput?.value?.trim() || '';
      const date = dateInput?.value || new Date().toISOString().split('T')[0];
      const category = document.getElementById('pageExpCategoryHidden')?.value || 'Food';
      const paymentMethod = document.getElementById('pageExpPaymentHidden')?.value || 'UPI';
      const notes = document.getElementById('pageExpNotes')?.value?.trim() || '';

      if (amount <= 0) {
        showToast('Please enter a valid expense amount.', 'error');
        amountInput?.focus();
        return;
      }
      if (!title) {
        showToast('Please enter what you bought.', 'error');
        itemInput?.focus();
        return;
      }

      try {
        const payload = {
          item: title,
          title,
          amount,
          date,
          category,
          paymentMethod,
          notes
        };
        await store.addExpense(payload);
        showToast('Expense added successfully.', 'success');
        document.getElementById('pageExpenseForm').reset();
        window.location.hash = '#dashboard';
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });

    document.getElementById('pageExpSubmitBtn')?.addEventListener('click', () => {
      const form = document.getElementById('pageExpenseForm');
      if (form && !form.checkValidity()) form.reportValidity();
    });

    // 3. Income / Budget Form
    document.getElementById('incomeForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const source = (document.getElementById('incomeSource') || document.getElementById('incomeSourceInput'))?.value?.trim();
      const amount = parseFloat((document.getElementById('incomeAmount') || document.getElementById('incomeAmountInput'))?.value) || 0;
      const date = (document.getElementById('incomeDate') || document.getElementById('incomeDateInput'))?.value;
      const paymentMethod = (document.getElementById('incomePayment') || document.getElementById('incomePaymentSelect'))?.value || 'UPI';
      const notes = (document.getElementById('incomeNotes') || document.getElementById('incomeNotesInput'))?.value?.trim() || '';

      if (amount <= 0 || !source || !date) {
        showToast('Please enter source, amount, and date.', 'error');
        return;
      }

      try {
        if (this.editingIncomeId) {
          await store.updateIncome(this.editingIncomeId, { source, amount, date, paymentMethod, notes });
          showToast('Budget / Pocket money updated successfully.', 'success');
        } else {
          await store.addIncome({ source, amount, date, paymentMethod, notes });
          showToast('Budget / Pocket money saved successfully.', 'success');
        }
        closeModal('incomeModal');
        this.renderCurrentView();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });

    document.getElementById('saveIncomeBtn')?.addEventListener('click', () => {
      const form = document.getElementById('incomeForm');
      if (form && !form.checkValidity()) form.reportValidity();
    });

    // 4. Monthly Overall Budget Form
    const handleBudgetSubmit = async (e) => {
      if (e) e.preventDefault();
      const input = document.getElementById('overallBudgetLimitInput') || document.getElementById('budgetAmountInput');
      const limit = parseFloat(input?.value) || 0;
      if (limit <= 0) {
        showToast('Enter a budget limit greater than 0.', 'error');
        input?.focus();
        return;
      }
      try {
        const monthKey = store.getSelectedMonth();
        if (typeof store.setBudget === 'function') {
          await store.setBudget(monthKey, limit);
        } else if (typeof store.setMonthlyBudget === 'function') {
          await store.setMonthlyBudget(monthKey, limit);
        }
        showToast('Monthly budget updated.', 'success');
        closeModal('budgetModal');
        this.renderCurrentView();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    };

    document.getElementById('budgetForm')?.addEventListener('submit', handleBudgetSubmit);
    document.getElementById('saveMonthlyBudgetBtn')?.addEventListener('click', (e) => {
      const form = document.getElementById('budgetForm');
      if (form && !form.checkValidity()) {
        form.reportValidity();
      } else {
        handleBudgetSubmit(e);
      }
    });

    // 5. Category Budget Form
    document.getElementById('categoryBudgetForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const categoryId = (document.getElementById('catBudgetCategorySelect') || document.getElementById('catBudgetSelect'))?.value;
      const limit = parseFloat((document.getElementById('catBudgetLimitInput') || document.getElementById('catBudgetAmount'))?.value) || 0;
      if (!categoryId || limit <= 0) {
        showToast('Select category and limit amount.', 'error');
        return;
      }
      try {
        const monthKey = store.getSelectedMonth();
        await store.setCategoryBudget(monthKey, categoryId, limit);
        showToast('Category budget saved.', 'success');
        closeModal('categoryBudgetModal');
        this.renderCurrentView();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });

    // 6. Custom Category Form
    document.getElementById('customCategoryForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = (document.getElementById('customCatName') || document.getElementById('catNameInput'))?.value?.trim();
      const color = (document.getElementById('customCatColorHidden') || document.getElementById('catColorInput'))?.value || '#00f0ff';
      const icon = (document.getElementById('customCatIcon') || document.getElementById('catIconInput'))?.value || 'more-horizontal';

      if (!label) {
        showToast('Category name is required.', 'error');
        return;
      }
      try {
        await store.createCategory({ label, color, icon });
        showToast(`Category "${label}" created.`, 'success');
        closeModal('customCategoryModal');
        this.renderCurrentView();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });

    // 7. Goals Form
    document.getElementById('goalForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('goalNameInput')?.value?.trim();
      const targetAmount = parseFloat((document.getElementById('goalTargetInput') || document.getElementById('goalTargetAmountInput'))?.value) || 0;
      const currentAmount = parseFloat(document.getElementById('goalCurrentInput')?.value) || 0;
      const deadline = document.getElementById('goalDeadlineInput')?.value || null;

      if (!name || targetAmount <= 0) {
        showToast('Provide goal name and target amount.', 'error');
        return;
      }
      try {
        await store.createGoal({ name, targetAmount, currentAmount, deadline });
        showToast(`Goal "${name}" created!`, 'success');
        closeModal('goalModal');
        this.renderCurrentView();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });

    // 8. Add Funds to Goal Form
    document.getElementById('addGoalFundsForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const goalId = document.getElementById('addFundsGoalId')?.value || document.getElementById('goalFundsGoalId')?.value || this.activeGoalId;
      const amount = parseFloat((document.getElementById('addFundsAmountInput') || document.getElementById('goalFundsAmountInput'))?.value) || 0;
      if (!goalId || amount <= 0) {
        showToast('Enter valid contribution amount.', 'error');
        return;
      }
      try {
        await store.addGoalFunds(goalId, amount);
        showToast('Contribution added to goal!', 'success');
        closeModal('addGoalFundsModal');
        this.renderCurrentView();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });

    // 9. Profile Edit Form
    document.getElementById('profileEditForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('profileNameInput') || document.getElementById('profileFullNameInput'))?.value?.trim();
      const phone = document.getElementById('profilePhoneInput')?.value?.trim();
      try {
        await store.updateProfile({ name, phone });
        showToast('Profile updated.', 'success');
        this.renderCurrentView();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });

    // 10. Settings Password Form
    document.getElementById('settingsPasswordForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = (document.getElementById('settingsNewPassword') || document.getElementById('newPasswordInput'))?.value;
      const confirmPassword = (document.getElementById('settingsConfirmPassword') || document.getElementById('confirmNewPasswordInput'))?.value;

      const user = authService.getCurrentUser();
      if (!user || !user.email) {
        showToast('Please sign in to update your password.', 'error');
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast('New passwords do not match.', 'error');
        return;
      }
      try {
        await api.request('/api/auth/reset-password', {
          method: 'POST',
          body: { email: user.email, newPassword, confirmPassword }
        });
        showToast('Password updated successfully.', 'success');
        document.getElementById('settingsPasswordForm').reset();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });

    // 11. Gmail Alert Configuration Form
    document.getElementById('mailConfigForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const gmailUser = document.getElementById('cfgSenderEmail')?.value?.trim();
      const gmailAppPassword = document.getElementById('cfgAppPassword')?.value?.trim();
      if (!gmailUser || !gmailAppPassword) {
        showToast('Please provide both sender Gmail and 16-character App Password.', 'error');
        return;
      }
      try {
        showToast('Verifying Gmail SMTP configuration...', 'info');
        const res = await api.request('/api/budgets/configure-mail', {
          method: 'POST',
          body: { gmailUser, gmailAppPassword, sendTestNow: true }
        });
        showToast(res.message || 'Gmail SMTP configured and verified!', 'success');
        closeModal('mailConfigModal');
        if (this.currentRoute === 'budget') {
          renderBudgetView(store.getSelectedMonth());
        }
      } catch (err) {
        showToast(err.message || 'Failed to configure Gmail SMTP.', 'error');
      }
    });

    // 12. Theme & Currency Change
    document.getElementById('themeSelect')?.addEventListener('change', (e) => {
      this.setTheme(e.target.value);
    });

    // 12. Deletion Confirmation Handler
    document.getElementById('confirmDeleteActionBtn')?.addEventListener('click', async () => {
      if (!this.pendingDeleteAction) return;
      try {
        await this.pendingDeleteAction();
        closeModal('deleteConfirmModal');
        this.pendingDeleteAction = null;
        this.renderCurrentView();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });

    // Table / List Action Delegation
    document.addEventListener('click', async (e) => {
      const editTxBtn = e.target.closest('.btn-edit-tx');
      const deleteTxBtn = e.target.closest('.btn-delete-tx');
      const deleteIncomeBtn = e.target.closest('.btn-delete-income');
      const deleteCatBtn = e.target.closest('.btn-delete-category');
      const deleteCatBudgetBtn = e.target.closest('.btn-delete-category-budget');
      const addFundsBtn = e.target.closest('.btn-add-funds');
      const deleteGoalBtn = e.target.closest('.btn-delete-goal');

      if (editTxBtn) {
        const id = editTxBtn.dataset.id;
        const type = editTxBtn.dataset.type;
        if (type === 'expense') {
          const exp = store.getAllExpenses().find(x => x.id === id);
          if (exp) {
            this.editingExpenseId = id;
            document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
            document.getElementById('modalExpAmount').value = exp.amount;
            document.getElementById('modalExpItem').value = exp.title || '';
            document.getElementById('modalExpDate').value = exp.date || '';
            document.getElementById('modalExpCategoryHidden').value = exp.category || 'Others';
            document.getElementById('modalExpPaymentHidden').value = exp.paymentMethod || 'UPI';
            document.getElementById('modalExpNotes').value = exp.notes || '';
            this.renderPills('modalCategoryPills', 'modalPaymentPills', 'modalExpCategoryHidden', 'modalExpPaymentHidden');
            openModal('expenseModal');
          }
        }
      }

      if (deleteTxBtn) {
        const id = deleteTxBtn.dataset.id;
        const type = deleteTxBtn.dataset.type;
        this.confirmDeletion(`Delete this ${type}? This action cannot be undone.`, async () => {
          if (type === 'expense') await store.deleteExpense(id);
          else await store.deleteIncome(id);
          showToast(`${type} removed.`, 'success');
        });
      }

      if (deleteIncomeBtn) {
        const id = deleteIncomeBtn.dataset.id;
        this.confirmDeletion('Delete this income record?', async () => {
          await store.deleteIncome(id);
          showToast('Income removed.', 'success');
        });
      }

      if (deleteCatBtn) {
        const id = deleteCatBtn.dataset.id;
        this.confirmDeletion('Delete this custom category?', async () => {
          await store.deleteCategory(id);
          showToast('Category removed.', 'success');
        });
      }

      if (deleteCatBudgetBtn) {
        const categoryId = deleteCatBudgetBtn.dataset.category;
        const monthKey = store.getSelectedMonth();
        this.confirmDeletion('Remove budget limit for this category?', async () => {
          await store.deleteCategoryBudget(monthKey, categoryId);
          showToast('Category budget removed.', 'success');
        });
      }

      if (addFundsBtn) {
        const goalId = addFundsBtn.dataset.id;
        this.activeGoalId = goalId;
        const goal = (store.getGoals ? store.getGoals() : []).find(g => g.id === goalId);
        const nameEl = document.getElementById('addFundsGoalName');
        if (nameEl && goal) nameEl.textContent = `Goal: ${goal.name}`;
        const idInput = document.getElementById('addFundsGoalId') || document.getElementById('goalFundsGoalId');
        if (idInput) idInput.value = goalId;
        const amtInput = document.getElementById('addFundsAmountInput') || document.getElementById('goalFundsAmountInput');
        if (amtInput) amtInput.value = '';
        openModal('addGoalFundsModal');
      }

      if (deleteGoalBtn) {
        const id = deleteGoalBtn.dataset.id;
        this.confirmDeletion('Delete this financial goal?', async () => {
          await store.deleteGoal(id);
          showToast('Goal removed.', 'success');
        });
      }
    });

    // Forgot Password Form Submit
    document.getElementById('forgotPasswordForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgotEmailInput')?.value?.trim();
      const newPassword = document.getElementById('forgotNewPasswordInput')?.value;
      const confirm = document.getElementById('forgotConfirmPasswordInput')?.value;
      const errBox = document.getElementById('forgotPasswordError');
      const succBox = document.getElementById('forgotPasswordSuccess');
      if (errBox) errBox.style.display = 'none';
      if (succBox) succBox.style.display = 'none';

      if (!email || !newPassword) {
        showToast('Please fill all required fields.', 'error');
        return;
      }
      if (newPassword !== confirm) {
        if (errBox) {
          errBox.textContent = 'Passwords do not match.';
          errBox.style.display = 'block';
        } else {
          showToast('Passwords do not match.', 'error');
        }
        return;
      }
      try {
        await api.request('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, newPassword })
        });
        showToast('Password updated! Please sign in with your new password.', 'success');
        closeModal('forgotPasswordModal');
        this.setAuthModalMode('login');
        openModal('authModal');
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message || 'Password reset failed.';
          errBox.style.display = 'block';
        } else {
          showToast(err.message || 'Password reset failed.', 'error');
        }
      }
    });

    // Delete Account Trigger
    document.getElementById('deleteAccountTriggerBtn')?.addEventListener('click', () => {
      this.confirmDeletion('Are you absolutely sure you want to permanently delete your account and all associated financial records? This action cannot be recovered.', async () => {
        await api.deleteAccount();
        authService.logout();
        showToast('Account deleted permanently.', 'info');
      });
    });
  }

  confirmDeletion(message, action, details = {}) {
    const msgEl = document.getElementById('deleteConfirmMessage');
    if (msgEl) msgEl.textContent = message;
    const titleEl = document.getElementById('deleteItemTitle');
    if (titleEl) titleEl.textContent = details.title || message;
    const amtEl = document.getElementById('deleteItemAmount');
    if (amtEl) {
      if (details.amount) {
        amtEl.textContent = formatCurrency(details.amount);
        amtEl.style.display = 'block';
      } else {
        amtEl.style.display = 'none';
      }
    }
    this.pendingDeleteAction = action;
    openModal('deleteConfirmModal');
  }

  /* --------------------------------------------------------------------------
     AUTHENTICATION ACTIONS (Sign In / Sign Up / Logout)
     -------------------------------------------------------------------------- */
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginGmailInput')?.value?.trim();
    const password = document.getElementById('loginPasswordInput')?.value;
    const submitBtn = document.getElementById('loginSubmitBtn');
    const origHtml = submitBtn ? submitBtn.innerHTML : 'Sign In';

    if (!email || !password) {
      showToast('Enter your email and password.', 'error');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Signing in...</span>';
      }
      await authService.login(email, password);
      showToast('Welcome back to Hisaabo!', 'success');
      closeModal('authModal');
      this.renderUserHeader();
      window.location.hash = '#dashboard';
      this.handleRouting();
    } catch (err) {
      showToast(err.message || 'Invalid email or password.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupNameInput')?.value?.trim();
    const emailInput = document.getElementById('signupGmailInput') || document.getElementById('signupEmailInput');
    const email = emailInput?.value?.trim();
    const password = document.getElementById('signupPasswordInput')?.value;
    const confirm = document.getElementById('signupConfirmPasswordInput')?.value;
    const submitBtn = document.getElementById('signupSubmitBtn');
    const origHtml = submitBtn ? submitBtn.innerHTML : 'Create Account';

    if (!name || !email || !password) {
      showToast('Please fill all required fields.', 'error');
      return;
    }
    if (confirm && password !== confirm) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Creating account...</span>';
      }
      await authService.signup({ name, email, password, confirmPassword: confirm });
      showToast('Account created successfully! Welcome to Hisaabo.', 'success');
      const loginEmailInput = document.getElementById('loginGmailInput');
      if (loginEmailInput) loginEmailInput.value = email;
      closeModal('authModal');
      this.renderUserHeader();
      window.location.hash = '#dashboard';
      this.handleRouting();
    } catch (err) {
      const errMsg = err.message || 'Registration failed. Please try again.';
      if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('exists') || errMsg.toLowerCase().includes('duplicate')) {
        showToast('Account already exists with this email. Switched to Sign In.', 'info');
        const loginEmailInput = document.getElementById('loginGmailInput');
        if (loginEmailInput) loginEmailInput.value = email;
        this.setAuthModalMode('login');
      } else {
        showToast(errMsg, 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    }
  }

  async handleLogout() {
    await authService.logout();
    showToast('Signed out of Hisaabo.', 'info');
    window.location.hash = '#home';
  }

  /* --------------------------------------------------------------------------
     DRAWER HELPERS
     -------------------------------------------------------------------------- */
  openMobileSidebar() {
    document.getElementById('appSidebar')?.classList.add('open');
    document.getElementById('sidebarBackdrop')?.classList.add('active');
  }

  closeMobileSidebar() {
    document.getElementById('appSidebar')?.classList.remove('open');
    document.getElementById('sidebarBackdrop')?.classList.remove('active');
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.hisaaboApp = new HisaaboApp();
});
