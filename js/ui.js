/**
 * ui.js - User Interface Rendering & Interactions (Design #7 Fintech System)
 * Manages DOM updates, modals, toasts, tables, cards, theme switching, and all 11 core views.
 */

import { CATEGORIES, PAYMENT_METHODS, store } from './store.js?v=3.2';
import { authService } from './auth.js?v=3.2';

export function getStoreMonthExpenses(monthKey) {
  if (typeof store.getMonthExpenses === 'function') return store.getMonthExpenses(monthKey);
  if (typeof store.getExpensesForMonth === 'function') return store.getExpensesForMonth(monthKey);
  if (typeof store.getAllExpenses === 'function') {
    return store.getAllExpenses().filter(e => (e.date ? e.date.substring(0, 7) : e.monthKey) === monthKey);
  }
  return [];
}

export function getStoreMonthIncome(monthKey) {
  if (typeof store.getMonthIncome === 'function') return store.getMonthIncome(monthKey);
  if (typeof store.getIncomeForMonth === 'function') return store.getIncomeForMonth(monthKey);
  if (typeof store.getAllIncome === 'function') {
    return store.getAllIncome().filter(i => (i.date ? i.date.substring(0, 7) : i.monthKey) === monthKey);
  }
  return [];
}

// Clean SVG Icons for offline & crisp rendering
export const ICONS = {
  utensils: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 2v10"/><path d="M12 2v6"/><path d="M3 2v6a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2"/><path d="M6 2v10"/><path d="M6 12v10"/><path d="M15 12v10"/></svg>',
  car: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  'shopping-bag': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  'graduation-cap': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>',
  film: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>',
  zap: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
  'heart-pulse': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg>',
  home: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  user: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>',
  'more-horizontal': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  wallet: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
  alertTriangle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
};

export function formatCurrency(amount) {
  const val = Number(amount) || 0;
  return '₹' + val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatMonthName(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function getCategoryBadge(categoryId) {
  const allCats = store.getCategories ? store.getCategories() : CATEGORIES;
  const cat = allCats.find(c => c.id === categoryId) || {
    id: categoryId,
    label: categoryId,
    name: categoryId,
    color: '#00f0ff',
    icon: 'more-horizontal'
  };

  const label = cat.label || cat.name || cat.id;
  const iconSvg = ICONS[cat.icon] || ICONS['more-horizontal'];
  return `<span class="category-badge-chip" style="color: ${cat.color}; background: ${cat.color}18; border: 1px solid ${cat.color}35;">
    ${iconSvg} <span>${label}</span>
  </span>`;
}

export function getPaymentBadge(paymentId) {
  const method = PAYMENT_METHODS.find(p => p.id === paymentId) || {
    id: paymentId,
    label: paymentId,
    color: '#38bdf8',
    icon: 'wallet'
  };

  const iconSvg = ICONS[method.icon] || ICONS.wallet;
  return `<span class="badge-payment" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--text-secondary);">
    ${iconSvg} <span>${method.label}</span>
  </span>`;
}

export function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Modal Helpers
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    void modal.offsetWidth; // Force layout recalculation for smooth CSS transitions
    modal.classList.add('active', 'modal-active');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active', 'modal-active');
    document.body.style.overflow = '';
    modal.style.display = 'none';
  }
}

// Toast Notifications (Design #7)
export function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-fintech ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

/**
 * 1. DASHBOARD: Update KPI Cards & Widgets (Section 8, 9, 12, 16)
 */
export function updateDashboardKPIs(monthKey) {
  const kpis = store.getMonthKPIs(monthKey);

  // Total Income
  const incomeEl = document.getElementById('kpiTotalIncome');
  if (incomeEl) incomeEl.textContent = formatCurrency(kpis.totalIncome);

  const incTrendEl = document.getElementById('kpiIncomeTrend');
  if (incTrendEl) {
    const change = kpis.incomeChangePercent;
    const isUp = change >= 0;
    incTrendEl.textContent = `${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${change}%`;
    incTrendEl.className = `trend-tag ${isUp ? 'trend-positive' : 'trend-negative'}`;
  }

  // Total Expenses
  const expEl = document.getElementById('kpiTotalSpent');
  if (expEl) expEl.textContent = formatCurrency(kpis.totalSpent);

  const expTrendEl = document.getElementById('kpiExpenseTrend');
  if (expTrendEl) {
    const change = kpis.expenseChangePercent;
    const isDown = change <= 0;
    expTrendEl.textContent = `${isDown ? '▼' : '▲'} ${change > 0 ? '+' : ''}${change}%`;
    expTrendEl.className = `trend-tag ${isDown ? 'trend-positive' : 'trend-negative'}`;
  }

  // Balance (Net Wealth = Income - Expenses)
  const balEl = document.getElementById('kpiBalance');
  if (balEl) balEl.textContent = formatCurrency(kpis.balance);

  const balTrendEl = document.getElementById('kpiBalanceTrend');
  const balSubtextEl = document.getElementById('kpiBalanceSubtext');
  if (balTrendEl) {
    if (kpis.balance >= 0) {
      balTrendEl.textContent = '● Positive Net';
      balTrendEl.className = 'trend-tag trend-cyan';
    } else {
      balTrendEl.textContent = '⚠️ Net Deficit';
      balTrendEl.className = 'trend-tag trend-negative';
    }
  }
  if (balSubtextEl) {
    balSubtextEl.textContent = `Net: ${formatCurrency(kpis.balance)}`;
  }

  // Monthly Budget Progress Widget
  const budgetSpentEl = document.getElementById('dashBudgetSpent');
  const budgetLimitEl = document.getElementById('dashBudgetLimit');
  const progressBarEl = document.getElementById('dashProgressBar');
  const budgetPctEl = document.getElementById('dashBudgetPct');
  const budgetRemEl = document.getElementById('dashBudgetRemaining');

  const pctValue = Math.round(Number(kpis.percentage !== undefined ? kpis.percentage : (kpis.percentUsed !== undefined ? kpis.percentUsed : 0))) || 0;

  if (budgetSpentEl) budgetSpentEl.textContent = formatCurrency(kpis.totalSpent);
  if (budgetLimitEl) budgetLimitEl.textContent = formatCurrency(kpis.budget);
  if (budgetPctEl) budgetPctEl.textContent = `${pctValue}% Consumed`;
  if (budgetRemEl) budgetRemEl.textContent = `${formatCurrency(Math.max(0, kpis.remaining))} Remaining`;

  if (progressBarEl) {
    const pct = Math.min(100, Math.max(0, pctValue));
    progressBarEl.style.width = `${pct}%`;
    progressBarEl.className = 'budget-progress-fill';
    if (pctValue >= 100) {
      progressBarEl.classList.add('danger');
    } else if (pctValue >= 85) {
      progressBarEl.classList.add('warning');
    }
  }

  // Milestone Badges
  const m50 = document.getElementById('dashMilestone50');
  const m90 = document.getElementById('dashMilestone90');
  const m100 = document.getElementById('dashMilestone100');
  if (m50) m50.classList.toggle('active-passed', pctValue >= 50);
  if (m90) m90.classList.toggle('active-passed', pctValue >= 90);
  if (m100) m100.classList.toggle('active-passed', pctValue >= 100);

  // Budget Alert Banner
  const alertBanner = document.getElementById('budgetAlertBanner');
  if (alertBanner) {
    if (pctValue >= 100) {
      alertBanner.style.display = 'flex';
      alertBanner.innerHTML = `<span>⚠️ <strong>Critical Budget Alert:</strong> You have exceeded your monthly budget of ${formatCurrency(kpis.budget)}!</span>`;
    } else if (pctValue >= 90) {
      alertBanner.style.display = 'flex';
      alertBanner.innerHTML = `<span>⚠️ <strong>Budget Warning:</strong> You have reached ${pctValue}% of your monthly spending limit.</span>`;
    } else {
      alertBanner.style.display = 'none';
    }
  }

  // Recent Transactions on Dashboard (Section 12)
  renderDashboardRecentTransactions(monthKey);
}

function renderDashboardRecentTransactions(monthKey) {
  const container = document.getElementById('dashboardRecentList');
  if (!container) return;

  const expenses = getStoreMonthExpenses(monthKey).map(e => ({ ...e, type: 'expense' }));
  const income = getStoreMonthIncome(monthKey).map(i => ({ ...i, type: 'income', category: i.source }));
  const combined = [...expenses, ...income].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);

  if (combined.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1.8rem; color: var(--text-muted); font-size: 0.88rem;">
        No recent activity logged this month.<br>
        <button type="button" class="btn-gradient-neon btn-sm trigger-add-expense" style="margin-top: 0.75rem;">+ Add First Expense</button>
      </div>
    `;
    return;
  }

  container.innerHTML = combined.map(item => {
    const isIncome = item.type === 'income';
    const sign = isIncome ? '+' : '-';
    const amtClass = isIncome ? 'text-neon-green' : 'text-neon-pink';
    const badge = isIncome
      ? `<span class="category-badge-chip" style="color: #10b981; background: rgba(16, 185, 129, 0.15);">💼 ${escapeHTML(item.source || 'Income')}</span>`
      : getCategoryBadge(item.category);

    return `
      <div class="recent-tx-row">
        <div class="recent-tx-left">
          <div class="recent-tx-icon" style="background: ${isIncome ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)'}; color: ${isIncome ? '#10b981' : '#f43f5e'};">
            ${isIncome ? '▲' : '▼'}
          </div>
          <div class="recent-tx-details">
            <span class="recent-tx-title">${escapeHTML(item.title || item.source || item.notes || 'Transaction')}</span>
            <span class="recent-tx-meta">
              <span>${formatDate(item.date)}</span> • ${badge}
            </span>
          </div>
        </div>
        <div class="recent-tx-amount ${amtClass}">
          ${sign}${formatCurrency(item.amount)}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 2. TRANSACTIONS PAGE (Section 14)
 */
export function renderTransactionsTable(options = {}) {
  const {
    typeFilter = 'all',
    categoryFilter = 'All',
    paymentFilter = 'All',
    searchQuery = '',
    sortOption = 'date-desc',
    currentPage = 1,
    pageSize = 10,
    monthKey = store.getSelectedMonth()
  } = options;

  const tableBody = document.getElementById('transactionsTableBody');
  const mobileList = document.getElementById('transactionsMobileList');
  const emptyState = document.getElementById('transactionsEmptyState');
  if (!tableBody) return;

  // Aggregate items
  let items = [];
  if (typeFilter === 'all' || typeFilter === 'expense') {
    const expenses = getStoreMonthExpenses(monthKey).map(e => ({
      id: e.id,
      type: 'expense',
      title: e.title || e.item || e.notes || 'Expense',
      amount: Number(e.amount) || 0,
      category: e.category,
      paymentMethod: e.paymentMethod,
      date: e.date,
      notes: e.notes
    }));
    items.push(...expenses);
  }
  if (typeFilter === 'all' || typeFilter === 'income') {
    const income = getStoreMonthIncome(monthKey).map(i => ({
      id: i.id,
      type: 'income',
      title: i.source || i.notes || 'Income',
      amount: Number(i.amount) || 0,
      category: i.source,
      paymentMethod: i.paymentMethod,
      date: i.date,
      notes: i.notes
    }));
    items.push(...income);
  }

  // Apply filters
  if (categoryFilter !== 'All') {
    items = items.filter(it => it.category === categoryFilter);
  }
  if (paymentFilter !== 'All') {
    items = items.filter(it => it.paymentMethod === paymentFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    items = items.filter(it =>
      (it.title && it.title.toLowerCase().includes(q)) ||
      (it.notes && it.notes.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q)) ||
      (it.paymentMethod && it.paymentMethod.toLowerCase().includes(q))
    );
  }

  // Sort
  items.sort((a, b) => {
    if (sortOption === 'date-asc') return (a.date || '').localeCompare(b.date || '');
    if (sortOption === 'amount-desc') return b.amount - a.amount;
    if (sortOption === 'amount-asc') return a.amount - b.amount;
    return (b.date || '').localeCompare(a.date || ''); // date-desc
  });

  const totalItems = items.length;
  if (totalItems === 0) {
    tableBody.innerHTML = '';
    if (mobileList) mobileList.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  // Pagination slice
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);

  // Pagination controls update
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginationInfo = document.getElementById('txPaginationInfo');
  if (paginationInfo) {
    paginationInfo.textContent = totalItems === 0
      ? 'Showing 0 transactions'
      : `Showing ${startIndex + 1}–${Math.min(totalItems, startIndex + pageSize)} of ${totalItems} transactions`;
  }
  const prevBtn = document.getElementById('txPrevPageBtn');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  const nextBtn = document.getElementById('txNextPageBtn');
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  const pageIndicator = document.getElementById('txPageIndicator');
  if (pageIndicator) {
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  }

  // Desktop Table Rows
  tableBody.innerHTML = pageItems.map(it => {
    const isInc = it.type === 'income';
    const typePill = isInc
      ? '<span class="trend-tag trend-positive">INCOME</span>'
      : '<span class="trend-tag trend-negative">EXPENSE</span>';
    const amtColor = isInc ? 'text-neon-green' : 'text-neon-pink';
    const sign = isInc ? '+' : '-';
    const catBadge = isInc
      ? `<span class="category-badge-chip" style="color: #10b981; background: rgba(16,185,129,0.15);">${escapeHTML(it.category)}</span>`
      : getCategoryBadge(it.category);

    return `
      <tr data-id="${it.id}" data-type="${it.type}">
        <td>${typePill}</td>
        <td style="white-space: nowrap; font-size: 0.82rem; color: var(--text-secondary);">${formatDate(it.date)}</td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary);">${escapeHTML(it.title)}</div>
          ${it.notes && it.notes !== it.title ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(it.notes)}</div>` : ''}
        </td>
        <td>${catBadge}</td>
        <td>${getPaymentBadge(it.paymentMethod)}</td>
        <td style="text-align: right; font-weight: 700; font-family: var(--font-heading); font-size: 1rem;" class="${amtColor}">
          ${sign}${formatCurrency(it.amount)}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="tx-action-btn btn-edit-tx" data-id="${it.id}" data-type="${it.type}" title="Edit">
            ${ICONS.edit}
          </button>
          <button type="button" class="tx-action-btn btn-delete btn-delete-tx" data-id="${it.id}" data-type="${it.type}" title="Delete">
            ${ICONS.trash}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Mobile Touch List
  if (mobileList) {
    mobileList.innerHTML = pageItems.map(it => {
      const isInc = it.type === 'income';
      const sign = isInc ? '+' : '-';
      const amtColor = isInc ? 'text-neon-green' : 'text-neon-pink';
      return `
        <div class="recent-tx-row" data-id="${it.id}" data-type="${it.type}">
          <div class="recent-tx-left">
            <div class="recent-tx-details">
              <span class="recent-tx-title">${escapeHTML(it.title)}</span>
              <span class="recent-tx-meta">
                <span>${formatDate(it.date)}</span> • ${escapeHTML(it.category)}
              </span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="${amtColor}" style="font-weight: 700;">${sign}${formatCurrency(it.amount)}</div>
            <button type="button" class="tx-action-btn btn-delete btn-delete-tx" data-id="${it.id}" data-type="${it.type}">
              ${ICONS.trash}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

/**
 * 3. INCOME VIEW (Section 15)
 */
export function renderIncomeView(monthKey) {
  const tableBody = document.getElementById('incomeTableBody');
  const totalEl = document.getElementById('incomeMetricTotal') || document.getElementById('incomeTotalThisMonth');
  const countEl = document.getElementById('incomeMetricCount') || document.getElementById('incomeRecordCount');
  const balEl = document.getElementById('incomeMetricBalance');
  const emptyState = document.getElementById('incomeEmptyState');

  const incomes = getStoreMonthIncome(monthKey);
  const total = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const kpis = store.getMonthKPIs(monthKey);

  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (countEl) countEl.textContent = `${incomes.length} ${incomes.length === 1 ? 'Entry' : 'Entries'}`;
  if (balEl) balEl.textContent = formatCurrency(kpis.balance);

  if (!tableBody) return;

  if (incomes.length === 0) {
    tableBody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  tableBody.innerHTML = incomes.map(inc => `
    <tr data-id="${inc.id}">
      <td style="color: var(--text-secondary); font-size: 0.82rem;">${formatDate(inc.date)}</td>
      <td style="font-weight: 700; color: var(--text-primary);">${escapeHTML(inc.source || 'Income')}</td>
      <td>${getPaymentBadge(inc.paymentMethod)}</td>
      <td style="color: var(--text-muted); font-size: 0.82rem;">${escapeHTML(inc.notes || '—')}</td>
      <td style="text-align: right; font-weight: 700; font-family: var(--font-heading);" class="text-neon-green">
        +${formatCurrency(inc.amount)}
      </td>
      <td style="text-align: right;">
        <button type="button" class="tx-action-btn btn-delete btn-delete-income" data-id="${inc.id}" title="Delete Income">
          ${ICONS.trash}
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * 4. BUDGET VIEW (Section 16)
 */
export function renderBudgetView(monthKey) {
  const kpis = store.getMonthKPIs(monthKey);

  const limitEl = document.getElementById('budgetPageLimitDisplay') || document.getElementById('budgetOverallLimit');
  const usedEl = document.getElementById('budgetPageSpentDisplay') || document.getElementById('budgetOverallUsed');
  const remEl = document.getElementById('budgetPageRemainingDisplay') || document.getElementById('budgetOverallRemaining');
  const fillEl = document.getElementById('budgetPageProgressBar') || document.getElementById('budgetOverallProgressFill');
  const statusEl = document.getElementById('budgetHealthTag') || document.getElementById('budgetOverallStatusBadge');
  const allowanceEl = document.getElementById('budgetPageDailyAllowance');

  if (limitEl) limitEl.textContent = formatCurrency(kpis.budget);
  if (usedEl) usedEl.textContent = formatCurrency(kpis.totalSpent);
  if (remEl) remEl.textContent = formatCurrency(Math.max(0, kpis.remaining));

  // Compute daily safe allowance
  const [yr, mn] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(yr, mn, 0).getDate();
  const today = new Date();
  const currentDay = (today.getFullYear() === yr && today.getMonth() + 1 === mn) ? today.getDate() : 1;
  const daysLeft = Math.max(1, daysInMonth - currentDay + 1);
  const dailyAllowance = Math.round((Math.max(0, kpis.remaining) / daysLeft) * 100) / 100;
  if (allowanceEl) allowanceEl.textContent = `${formatCurrency(dailyAllowance)} / day`;

  const pctValue = Math.round(Number(kpis.percentage !== undefined ? kpis.percentage : (kpis.percentUsed !== undefined ? kpis.percentUsed : 0))) || 0;

  if (fillEl) {
    const pct = Math.min(100, Math.max(0, pctValue));
    fillEl.style.width = `${pct}%`;
    fillEl.className = 'budget-master-fill';
    if (pctValue >= 100) fillEl.classList.add('danger');
    else if (pctValue >= 85) fillEl.classList.add('warning');
  }

  if (statusEl) {
    if (pctValue >= 100) {
      statusEl.textContent = `Critical (${pctValue}% Used)`;
      statusEl.className = 'budget-health-tag trend-negative';
    } else if (pctValue >= 85) {
      statusEl.textContent = `Warning (${pctValue}% Used)`;
      statusEl.className = 'budget-health-tag trend-negative';
    } else {
      statusEl.textContent = `Safe (${pctValue}% Used)`;
      statusEl.className = 'budget-health-tag';
    }
  }

  // Update milestone visual boxes & states
  const b50 = document.getElementById('badgeState50');
  const b90 = document.getElementById('badgeState90');
  const b100 = document.getElementById('badgeState100');
  const box50 = document.getElementById('boxMilestone50');
  const box90 = document.getElementById('boxMilestone90');
  const box100 = document.getElementById('boxMilestone100');
  if (b50) {
    b50.textContent = pctValue >= 50 ? 'Triggered' : 'Pending';
    b50.className = `milestone-badge-state ${pctValue >= 50 ? 'active' : ''}`;
  }
  if (box50) box50.classList.toggle('milestone-passed', pctValue >= 50);
  if (b90) {
    b90.textContent = pctValue >= 90 ? 'Triggered' : 'Pending';
    b90.className = `milestone-badge-state ${pctValue >= 90 ? 'active' : ''}`;
  }
  if (box90) box90.classList.toggle('milestone-passed', pctValue >= 90);
  if (b100) {
    b100.textContent = pctValue >= 100 ? 'Triggered' : 'Pending';
    b100.className = `milestone-badge-state ${pctValue >= 100 ? 'active' : ''}`;
  }
  if (box100) box100.classList.toggle('milestone-passed', pctValue >= 100);

  // Category Budgets Grid
  const catContainer = document.getElementById('categoryBudgetsGrid') || document.getElementById('categoryBudgetsContainer');
  if (!catContainer) return;

  const rawCatBudgets = store.getCategoryBudgets ? store.getCategoryBudgets(monthKey) : {};
  const catSpending = store.getCategoryBreakdown ? store.getCategoryBreakdown(monthKey) : {};

  let catBudgetList = [];
  if (Array.isArray(rawCatBudgets)) {
    catBudgetList = rawCatBudgets.map(cb => ({
      categoryId: cb.categoryId || cb.category || cb.id,
      limitAmount: Number(cb.limitAmount || cb.amount || cb.limit) || 0
    }));
  } else if (rawCatBudgets && typeof rawCatBudgets === 'object') {
    catBudgetList = Object.entries(rawCatBudgets).map(([categoryId, limitAmount]) => ({
      categoryId,
      limitAmount: Number(limitAmount) || 0
    }));
  }

  if (catBudgetList.length === 0) {
    catContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem;" class="glass-panel">
        <p style="color: var(--text-muted); margin-bottom: 1rem;">No individual category spending limits set for this month.</p>
        <button type="button" id="emptyAddCategoryBudgetBtn" class="btn-gradient-neon btn-sm trigger-add-category-budget">
          + Set Category Budget
        </button>
      </div>
    `;
    return;
  }

  catContainer.innerHTML = catBudgetList.map(cb => {
    const spent = catSpending[cb.categoryId] || 0;
    const limit = Number(cb.limitAmount) || 1;
    const pct = Math.round((spent / limit) * 100);
    const isOver = pct >= 100;
    const isWarning = pct >= 80 && !isOver;

    return `
      <div class="category-budget-card glass-panel">
        <div class="cat-budget-header">
          ${getCategoryBadge(cb.categoryId)}
          <span class="trend-tag ${isOver ? 'trend-negative' : isWarning ? 'trend-negative' : 'trend-positive'}">
            ${pct}% ${isOver ? 'Exceeded' : 'Used'}
          </span>
        </div>
        <div class="cat-budget-amounts">
          <span>Spent: ${formatCurrency(spent)}</span>
          <span style="color: var(--text-muted);">Cap: ${formatCurrency(limit)}</span>
        </div>
        <div class="budget-progress-track">
          <div class="budget-progress-fill ${isOver ? 'danger' : isWarning ? 'warning' : ''}" style="width: ${Math.min(100, pct)}%;"></div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
          <button type="button" class="btn-ghost-sm btn-edit-category-budget" data-category="${cb.categoryId}" data-limit="${cb.limitAmount}">Edit</button>
          <button type="button" class="btn-ghost-sm btn-delete-category-budget" data-category="${cb.categoryId}">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 5. CATEGORIES VIEW (Section 17)
 */
export function renderCategoriesView() {
  const container = document.getElementById('categoriesGrid') || document.getElementById('categoriesGridContainer');
  if (!container) return;

  const categories = store.getCategories ? store.getCategories() : CATEGORIES;
  const monthKey = store.getSelectedMonth();
  const spending = store.getCategoryBreakdown(monthKey);

  container.innerHTML = categories.map(cat => {
    const spent = spending[cat.id] || 0;
    const iconSvg = ICONS[cat.icon] || ICONS['more-horizontal'];
    const isCustom = cat.isCustom || !cat.isDefault;

    return `
      <div class="category-card-fintech glass-panel">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: ${cat.color || '#38bdf8'}22; color: ${cat.color || '#38bdf8'}; display: flex; align-items: center; justify-content: center; border: 1px solid ${cat.color || '#38bdf8'}44;">
            ${iconSvg}
          </div>
          <span style="font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: var(--radius-full); background: rgba(255,255,255,0.06); color: var(--text-muted);">
            ${isCustom ? 'Custom' : 'Standard'}
          </span>
        </div>
        <div>
          <h4 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.2rem;">${escapeHTML(cat.label || cat.name || cat.id)}</h4>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Spent this month: <strong>${formatCurrency(spent)}</strong></span>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: auto;">
          ${isCustom ? `<button type="button" class="tx-action-btn btn-delete btn-delete-category" data-id="${cat.id}">${ICONS.trash}</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 6. CALENDAR VIEW (Section 20)
 */
export function renderCalendarView(monthKey, selectedDate = null) {
  const gridEl = document.getElementById('calendarDaysGrid') || document.getElementById('calendarGrid');
  const monthDisplayEl = document.getElementById('calCurrentMonthDisplay');
  if (!gridEl) return;

  if (monthDisplayEl) monthDisplayEl.textContent = formatMonthName(monthKey);

  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);

  const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month, 0).getDate();

  const dailyExpenses = store.getDailySpending ? store.getDailySpending(monthKey) : [];
  const incomes = getStoreMonthIncome(monthKey);
  const incomeDates = new Set(incomes.map(i => i.date));

  // Determine active selected day
  const activeDate = selectedDate || `${monthKey}-01`;

  let html = '';
  // Empty offset days
  for (let i = 0; i < firstDayIndex; i++) {
    html += '<div class="calendar-day-cell other-month"></div>';
  }

  // Days in month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
    const spent = dailyExpenses[dateStr] || 0;
    const hasIncome = incomeDates.has(dateStr);
    const isSelected = dateStr === activeDate;

    html += `
      <div class="calendar-day-cell ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
        <span class="day-number">${d}</span>
        <div class="day-indicators">
          ${spent > 0 ? `<span style="color: var(--neon-pink);">-${formatCurrency(spent)}</span>` : ''}
          ${hasIncome ? `<span style="color: var(--neon-emerald);">+Income</span>` : ''}
        </div>
      </div>
    `;
  }

  gridEl.innerHTML = html;

  // Render selected day details drawer
  renderCalendarSelectedDay(activeDate);
}

export function renderCalendarSelectedDay(dateStr) {
  const titleEl = document.getElementById('calendarSelectedDateLabel') || document.getElementById('calSelectedDateTitle');
  const spentEl = document.getElementById('calendarSelectedDateTotal') || document.getElementById('calSelectedTotalSpent');
  const incEl = document.getElementById('calSelectedTotalIncome');
  const listEl = document.getElementById('calendarSelectedDateList') || document.getElementById('calSelectedTransactionsList');

  if (titleEl) titleEl.textContent = formatDate(dateStr);

  const monthKey = dateStr.substring(0, 7);
  const dayExpenses = getStoreMonthExpenses(monthKey).filter(e => e.date === dateStr);
  const dayIncome = getStoreMonthIncome(monthKey).filter(i => i.date === dateStr);

  const totalSpent = dayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalIncome = dayIncome.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  if (spentEl) spentEl.textContent = `${formatCurrency(totalSpent)} Spent`;
  if (incEl) incEl.textContent = formatCurrency(totalIncome);

  if (!listEl) return;

  const combined = [
    ...dayExpenses.map(e => ({ ...e, type: 'expense' })),
    ...dayIncome.map(i => ({ ...i, type: 'income', title: i.source }))
  ];

  if (combined.length === 0) {
    listEl.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No transactions on this date.</div>';
    return;
  }

  listEl.innerHTML = combined.map(it => {
    const isInc = it.type === 'income';
    return `
      <div class="recent-tx-row">
        <div>
          <div style="font-weight: 700; font-size: 0.88rem;">${escapeHTML(it.title || it.notes || 'Entry')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(it.category || it.source || '')}</div>
        </div>
        <div class="${isInc ? 'text-neon-green' : 'text-neon-pink'}" style="font-weight: 700;">
          ${isInc ? '+' : '-'}${formatCurrency(it.amount)}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 7. ANALYTICS VIEW (Section 18)
 */
export function renderAnalyticsView(monthKey) {
  const kpis = store.getMonthKPIs(monthKey);
  const daily = store.getDailySpending(monthKey);
  const breakdown = store.getCategoryBreakdown(monthKey);

  // Highest spending day
  let maxDay = '—';
  let maxDayAmount = 0;
  Object.entries(daily).forEach(([d, val]) => {
    if (val > maxDayAmount) {
      maxDayAmount = val;
      maxDay = formatDate(d);
    }
  });

  // Highest category
  let maxCat = '—';
  let maxCatAmount = 0;
  Object.entries(breakdown).forEach(([cid, val]) => {
    if (val > maxCatAmount) {
      maxCatAmount = val;
      maxCat = cid;
    }
  });

  const daysCount = Object.keys(daily).length || 1;
  const avgDaily = kpis.totalSpent / daysCount;

  const elHighestDay = document.getElementById('anHighestDay');
  const elHighestCat = document.getElementById('anTopCategory') || document.getElementById('anHighestCategory');
  const elDailyAvg = document.getElementById('anAvgDaily') || document.getElementById('anDailyAvg');
  const elTotalMonth = document.getElementById('anTotalMonthly');
  const elPrevComp = document.getElementById('anPreviousComparison');
  const elTxCount = document.getElementById('anTxCount');

  if (elHighestDay) elHighestDay.textContent = maxDayAmount > 0 ? `${maxDay} (${formatCurrency(maxDayAmount)})` : 'None';
  if (elHighestCat) elHighestCat.textContent = maxCatAmount > 0 ? `${maxCat} (${formatCurrency(maxCatAmount)})` : 'None';
  if (elDailyAvg) elDailyAvg.textContent = formatCurrency(avgDaily);
  if (elTotalMonth) elTotalMonth.textContent = formatCurrency(kpis.totalSpent);
  if (elTxCount) elTxCount.textContent = getStoreMonthExpenses(monthKey).length + getStoreMonthIncome(monthKey).length;
  if (elPrevComp) {
    const ch = kpis.expenseChangePercent;
    elPrevComp.textContent = `${ch >= 0 ? '+' : ''}${ch}% vs last month`;
  }

  // Top Categories Ranked
  const topCatContainer = document.getElementById('anRankedCategoriesList') || document.getElementById('topCategoriesContainer');
  if (topCatContainer) {
    const sortedCats = Object.entries(breakdown)
      .filter(([_, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedCats.length === 0) {
      topCatContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem;">No spending records yet.</div>';
    } else {
      topCatContainer.innerHTML = sortedCats.map(([cid, val], idx) => `
        <div class="top-cat-item">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-weight: 800; font-size: 0.85rem; color: var(--neon-cyan);">#${idx + 1}</span>
            ${getCategoryBadge(cid)}
          </div>
          <span style="font-weight: 700; font-family: var(--font-heading);">${formatCurrency(val)}</span>
        </div>
      `).join('');
    }
  }

  // Real Dynamic Spending Insights (Section 18)
  const insightsContainer = document.getElementById('anInsightsList') || document.getElementById('spendingInsightsContainer');
  if (insightsContainer) {
    const insights = [];
    if (kpis.totalSpent > 0 && maxCatAmount > 0) {
      const topPct = Math.round((maxCatAmount / kpis.totalSpent) * 100);
      insights.push(`<strong>${maxCat}</strong> represents <strong>${topPct}%</strong> of your monthly expenses.`);
    }
    if (kpis.savingsRate > 0) {
      insights.push(`You have a healthy savings rate of <strong>${kpis.savingsRate}%</strong> this period.`);
    }
    if (avgDaily > 0) {
      insights.push(`Your daily spending average is currently <strong>${formatCurrency(avgDaily)}</strong>.`);
    }
    if (kpis.percentage >= 90) {
      insights.push(`⚠️ You have utilized <strong>${kpis.percentage}%</strong> of your monthly budget.`);
    }
    if (insights.length === 0) {
      insights.push('Log transactions to generate automated financial insights.');
    }

    insightsContainer.innerHTML = insights.map(txt => `
      <div class="insight-card-pill">
        <span style="color: var(--neon-cyan);">💡</span>
        <span>${txt}</span>
      </div>
    `).join('');
  }
}

/**
 * 8. GOALS VIEW (Section 19)
 */
export function renderGoalsView() {
  const container = document.getElementById('goalsGrid') || document.getElementById('goalsGridContainer');
  if (!container) return;

  const goals = store.getGoals ? store.getGoals() : [];
  if (goals.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;" class="glass-panel">
        <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem;">No Financial Goals Yet</h3>
        <p style="color: var(--text-secondary); margin-bottom: 1.25rem;">Create a target for your emergency fund, gadgets, travel, or savings.</p>
        <button type="button" class="btn-gradient-neon btn-sm trigger-add-goal" id="emptyAddGoalBtn">+ Create First Goal</button>
      </div>
    `;
    return;
  }

  container.innerHTML = goals.map(g => {
    const current = Number(g.currentAmount) || 0;
    const target = Number(g.targetAmount) || 1;
    const pct = Math.min(100, Math.round((current / target) * 100));

    return `
      <div class="goal-card-fintech glass-panel" data-id="${g.id}">
        <div class="goal-card-header">
          <h4 class="goal-title">${escapeHTML(g.name)}</h4>
          <span class="trend-tag ${pct >= 100 ? 'trend-positive' : 'trend-cyan'}">${pct}%</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Target Date: ${g.deadline ? formatDate(g.deadline) : 'Ongoing'}
        </div>
        <div class="cat-budget-amounts">
          <span>Saved: ${formatCurrency(current)}</span>
          <span style="color: var(--text-muted);">Goal: ${formatCurrency(target)}</span>
        </div>
        <div class="budget-progress-track">
          <div class="budget-progress-fill" style="width: ${pct}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
          <button type="button" class="btn-gradient-neon btn-sm btn-add-funds" data-id="${g.id}">+ Add Funds</button>
          <button type="button" class="tx-action-btn btn-delete btn-delete-goal" data-id="${g.id}">${ICONS.trash}</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 9. PROFILE VIEW (Section 21)
 */
export function renderProfileView() {
  const user = authService.getCurrentUser() || {};
  const stats = store.getProfileStats ? store.getProfileStats() : {};

  const nameEl = document.getElementById('profilePageName') || document.getElementById('profileFullNameDisplay');
  const emailEl = document.getElementById('profilePageEmail') || document.getElementById('profileEmailDisplay');
  const phoneEl = document.getElementById('profilePhoneDisplay');

  const avatarImg = document.getElementById('profilePageAvatarImg') || document.getElementById('profileAvatarLarge');
  const avatarInit = document.getElementById('profilePageAvatarInitial') || document.getElementById('profileAvatarInitialLarge');

  const nameInput = document.getElementById('profileNameInput') || document.getElementById('profileFullNameInput');
  const phoneInput = document.getElementById('profilePhoneInput');

  if (nameEl) nameEl.textContent = user.name || 'Hisaabo User';
  if (emailEl) emailEl.textContent = user.email || '—';
  if (phoneEl) phoneEl.textContent = user.phone || 'Not added';

  if (nameInput) nameInput.value = user.name || '';
  if (phoneInput) phoneInput.value = user.phone || '';

  const initial = ((user.name || user.email || 'U').charAt(0)).toUpperCase();
  if (user.picture && !user.picture.startsWith('data:image/svg')) {
    if (avatarImg) { avatarImg.src = user.picture; avatarImg.style.display = 'block'; }
    if (avatarInit) avatarInit.style.display = 'none';
  } else {
    if (avatarImg) avatarImg.style.display = 'none';
    if (avatarInit) { avatarInit.textContent = initial; avatarInit.style.display = 'flex'; }
  }

  // Lifetime activity stats
  const statExp = document.getElementById('profileStatTotalExp');
  const statInc = document.getElementById('profileStatTotalInc');
  const statCount = document.getElementById('profileStatCount') || document.getElementById('profileTotalTransactions');
  const statGoals = document.getElementById('profileStatGoals') || document.getElementById('profileActiveGoals');
  const statDate = document.getElementById('profileStatDate') || document.getElementById('profileMemberSinceDisplay');

  const allExpenses = store.getAllExpenses();
  const totalExp = allExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  if (statExp) statExp.textContent = formatCurrency(stats.totalExpense || totalExp);
  if (statInc) statInc.textContent = formatCurrency(stats.totalIncome || 0);
  if (statCount) statCount.textContent = stats.totalTransactions || allExpenses.length;
  if (statGoals) statGoals.textContent = stats.activeGoals || (store.getGoals ? store.getGoals().length : 0);
  if (statDate) statDate.textContent = user.createdAt ? formatDate(user.createdAt.split('T')[0]) : 'Recent';
}

/**
 * 10. SETTINGS VIEW (Section 22)
 */
export function renderSettingsView() {
  const settings = store.getUserSettings ? store.getUserSettings() : {};
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'midnight';
  const themeSelect = document.getElementById('themeSelect');
  const currencySelect = document.getElementById('settingsCurrencySelect') || document.getElementById('currencySelect');

  if (themeSelect && settings.theme) themeSelect.value = settings.theme;
  if (currencySelect && settings.currency) currencySelect.value = settings.currency;

  document.querySelectorAll('.theme-choice-btn').forEach(btn => {
    const t = btn.getAttribute('data-set-theme');
    btn.classList.toggle('active', t === currentTheme);
  });
}

/**
 * Updates topbar and sidebar with authenticated user identity
 */
export function updateAuthUI(user) {
  const userNameEl = document.getElementById('sidebarUserName');
  const userEmailEl = document.getElementById('sidebarUserEmail');
  const avatarImg = document.getElementById('sidebarAvatarImg');
  const avatarInit = document.getElementById('sidebarAvatarInitial');
  const greetingName = document.getElementById('dashGreetingName');

  if (user && user.email) {
    const displayName = user.name || user.email.split('@')[0];
    const initial = (displayName.charAt(0) || 'U').toUpperCase();

    if (userNameEl) userNameEl.textContent = displayName;
    if (userEmailEl) userEmailEl.textContent = user.email;
    if (greetingName) greetingName.textContent = user.givenName || displayName.split(' ')[0];

    if (user.picture && !user.picture.startsWith('data:image/svg')) {
      if (avatarImg) { avatarImg.src = user.picture; avatarImg.style.display = 'block'; }
      if (avatarInit) avatarInit.style.display = 'none';
    } else {
      if (avatarImg) avatarImg.style.display = 'none';
      if (avatarInit) { avatarInit.textContent = initial; avatarInit.style.display = 'flex'; }
    }
  }
}
