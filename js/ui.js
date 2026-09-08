/**
 * ui.js - User Interface Rendering & Interactions
 * Manages DOM updates, modals, toasts, tables, cards, and theme switching.
 */

import { CATEGORIES, PAYMENT_METHODS } from './store.js';
import { authService } from './auth.js';

// SVG Icons mapping for offline & crisp rendering
const ICONS = {
  utensils: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 2v10"/><path d="M12 2v6"/><path d="M3 2v6a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2"/><path d="M6 2v10"/><path d="M6 12v10"/><path d="M15 12v10"/></svg>',
  car: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  'shopping-bag': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  'graduation-cap': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>',
  film: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>',
  zap: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
  'heart-pulse': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg>',
  home: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  user: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>',
  'more-horizontal': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  banknote: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
  smartphone: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
  'credit-card': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
  building: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>',
  wallet: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
  alertTriangle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
  checkCircle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
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
  const cat = CATEGORIES.find(c => c.id === categoryId) || {
    id: categoryId,
    label: categoryId,
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.15)',
    icon: 'more-horizontal'
  };

  const iconSvg = ICONS[cat.icon] || ICONS['more-horizontal'];
  return `<span class="badge-cat" style="color: ${cat.color}; background-color: ${cat.bg}; border: 1px solid ${cat.color}33;">
    ${iconSvg} <span>${cat.label}</span>
  </span>`;
}

export function getPaymentBadge(paymentId) {
  const method = PAYMENT_METHODS.find(p => p.id === paymentId) || {
    id: paymentId,
    label: paymentId,
    color: '#64748b',
    icon: 'wallet'
  };

  const iconSvg = ICONS[method.icon] || ICONS.wallet;
  return `<span class="badge-payment">
    ${iconSvg} <span>${method.label}</span>
  </span>`;
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'error' ? ICONS.alertTriangle : ICONS.checkCircle;
  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  container.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  });

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

export function updateDashboardKPIs(kpis) {
  const totalSpentEl = document.getElementById('kpiTotalSpent');
  const budgetEl = document.getElementById('kpiBudget');
  const remainingEl = document.getElementById('kpiRemaining');
  const remainingLabelEl = document.getElementById('kpiRemainingLabel');
  const txCountEl = document.getElementById('kpiTxCount');
  const avgExpenseEl = document.getElementById('kpiAvgExpense');
  const highestExpenseEl = document.getElementById('kpiHighestExpense');
  const highestItemEl = document.getElementById('kpiHighestItem');
  const progressBarEl = document.getElementById('kpiProgressBar');
  const progressTextEl = document.getElementById('kpiProgressText');
  const alertBannerEl = document.getElementById('budgetAlertBanner');

  if (totalSpentEl) totalSpentEl.textContent = formatCurrency(kpis.totalSpent);
  if (budgetEl) budgetEl.textContent = formatCurrency(kpis.budget);
  
  if (remainingEl) {
    if (kpis.remaining < 0) {
      remainingEl.textContent = `- ${formatCurrency(Math.abs(kpis.remaining))}`;
      remainingEl.className = 'kpi-value text-danger';
    } else {
      remainingEl.textContent = formatCurrency(kpis.remaining);
      remainingEl.className = 'kpi-value text-success';
    }
  }

  if (remainingLabelEl) {
    remainingLabelEl.textContent = kpis.remaining < 0 ? 'Over Budget' : 'Remaining Budget';
  }

  if (txCountEl) txCountEl.textContent = kpis.transactionCount;
  if (avgExpenseEl) avgExpenseEl.textContent = formatCurrency(kpis.averageExpense);
  
  if (highestExpenseEl) {
    highestExpenseEl.textContent = formatCurrency(kpis.highestExpense.amount);
  }
  if (highestItemEl) {
    highestItemEl.textContent = kpis.highestExpense.amount > 0 ? `(${kpis.highestExpense.item})` : '';
  }

  // Progress Bar
  if (progressBarEl && progressTextEl) {
    const pct = Math.min(kpis.actualPercent, 100);
    progressBarEl.style.width = `${pct}%`;

    progressBarEl.classList.remove('progress-green', 'progress-amber', 'progress-orange', 'progress-red');
    if (kpis.is100PercentReached) {
      progressBarEl.classList.add('progress-red');
    } else if (kpis.is90PercentReached) {
      progressBarEl.classList.add('progress-orange');
    } else if (kpis.is50PercentReached) {
      progressBarEl.classList.add('progress-amber');
    } else {
      progressBarEl.classList.add('progress-green');
    }

    progressTextEl.textContent = `${kpis.actualPercent}% of budget used`;
  }

  // Update milestone marker chips
  const m50 = document.getElementById('milestone50');
  const m90 = document.getElementById('milestone90');
  const m100 = document.getElementById('milestone100');

  if (m50) {
    m50.classList.toggle('reached', Boolean(kpis.is50PercentReached));
  }
  if (m90) {
    m90.classList.toggle('reached', Boolean(kpis.is90PercentReached));
  }
  if (m100) {
    m100.classList.toggle('reached', Boolean(kpis.is100PercentReached));
  }

  // Budget Alert Banner (50%, 90%, 100% thresholds)
  if (alertBannerEl) {
    if (kpis.is100PercentReached) {
      const overBy = Math.max(0, kpis.totalSpent - kpis.budget);
      alertBannerEl.className = 'alert-banner alert-danger';
      alertBannerEl.innerHTML = `
        <div class="alert-icon">${ICONS.alertTriangle}</div>
        <div class="alert-content">
          <div class="alert-title">🛑 100% Budget Limit Reached / Exceeded</div>
          <div>You have consumed <strong>${kpis.actualPercent}%</strong> of your monthly budget${overBy > 0 ? ` (over by <strong>${formatCurrency(overBy)}</strong>)` : ''}. Automated Gmail alert notification dispatched.</div>
        </div>
      `;
      alertBannerEl.style.display = 'flex';
    } else if (kpis.is90PercentReached) {
      alertBannerEl.className = 'alert-banner alert-orange';
      alertBannerEl.innerHTML = `
        <div class="alert-icon">${ICONS.alertTriangle}</div>
        <div class="alert-content">
          <div class="alert-title">🚨 Urgent: 90% Budget Consumed</div>
          <div>You have used <strong>${kpis.actualPercent}%</strong> of your monthly budget. Only <strong>${formatCurrency(kpis.remaining)}</strong> remains. Automated Gmail warning dispatched.</div>
        </div>
      `;
      alertBannerEl.style.display = 'flex';
    } else if (kpis.is50PercentReached) {
      alertBannerEl.className = 'alert-banner alert-warning';
      alertBannerEl.innerHTML = `
        <div class="alert-icon">${ICONS.alertTriangle}</div>
        <div class="alert-content">
          <div class="alert-title">⚠️ 50% Budget Milestone Reached</div>
          <div>You have reached half (<strong>${kpis.actualPercent}%</strong>) of your planned monthly budget (Spent: ${formatCurrency(kpis.totalSpent)} / ${formatCurrency(kpis.budget)}). Automated Gmail milestone alert dispatched.</div>
        </div>
      `;
      alertBannerEl.style.display = 'flex';
    } else {
      alertBannerEl.style.display = 'none';
    }
  }
}

export function renderExpenseTable(expenses, onEdit, onDuplicate, onDelete) {
  const tbody = document.getElementById('expenseTableBody');
  const cardList = document.getElementById('expenseCardList');
  const emptyState = document.getElementById('tableEmptyState');
  const tableWrapper = document.getElementById('tableWrapper');
  const tableSummary = document.getElementById('tableSummaryText');

  if (!tbody || !cardList) return;

  tbody.innerHTML = '';
  cardList.innerHTML = '';

  if (!expenses || expenses.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (cardList) cardList.style.display = 'none';
    if (tableSummary) tableSummary.textContent = 'Showing 0 transactions';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (tableWrapper) tableWrapper.style.display = 'block';
  if (cardList) cardList.style.display = 'flex';

  const totalFiltered = expenses.reduce((sum, item) => sum + item.amount, 0);
  if (tableSummary) {
    tableSummary.textContent = `Showing ${expenses.length} transaction${expenses.length === 1 ? '' : 's'} (Total: ${formatCurrency(totalFiltered)})`;
  }

  expenses.forEach(exp => {
    // 1. Table Row (Desktop)
    const tr = document.createElement('tr');
    tr.className = 'expense-row';
    tr.dataset.id = exp.id;

    tr.innerHTML = `
      <td class="col-date">${formatDate(exp.date)}</td>
      <td class="col-item">
        <div class="item-title">${escapeHTML(exp.item)}</div>
        ${exp.notes ? `<div class="item-notes">${escapeHTML(exp.notes)}</div>` : ''}
      </td>
      <td class="col-category">${getCategoryBadge(exp.category)}</td>
      <td class="col-payment">${getPaymentBadge(exp.paymentMethod)}</td>
      <td class="col-amount">${formatCurrency(exp.amount)}</td>
      <td class="col-actions">
        <div class="action-btn-group">
          <button class="btn-icon btn-edit" title="Edit Expense" data-id="${exp.id}">${ICONS.edit}</button>
          <button class="btn-icon btn-duplicate" title="Duplicate Expense" data-id="${exp.id}">${ICONS.copy}</button>
          <button class="btn-icon btn-delete" title="Delete Expense" data-id="${exp.id}">${ICONS.trash}</button>
        </div>
      </td>
    `;

    // Attach row events
    tr.querySelector('.btn-edit').addEventListener('click', () => onEdit(exp.id));
    tr.querySelector('.btn-duplicate').addEventListener('click', () => onDuplicate(exp.id));
    tr.querySelector('.btn-delete').addEventListener('click', () => onDelete(exp.id));
    tbody.appendChild(tr);

    // 2. Card View (Mobile)
    const card = document.createElement('div');
    card.className = 'expense-card';
    card.dataset.id = exp.id;
    card.innerHTML = `
      <div class="card-header-row">
        <div>
          <span class="card-date">${formatDate(exp.date)}</span>
          <h4 class="card-item-title">${escapeHTML(exp.item)}</h4>
        </div>
        <div class="card-amount">${formatCurrency(exp.amount)}</div>
      </div>
      <div class="card-badges-row">
        ${getCategoryBadge(exp.category)}
        ${getPaymentBadge(exp.paymentMethod)}
      </div>
      ${exp.notes ? `<p class="card-notes">${escapeHTML(exp.notes)}</p>` : ''}
      <div class="card-actions-row">
        <button class="btn-secondary btn-sm btn-edit-card" data-id="${exp.id}">${ICONS.edit} Edit</button>
        <button class="btn-secondary btn-sm btn-dup-card" data-id="${exp.id}">${ICONS.copy} Copy</button>
        <button class="btn-danger-outline btn-sm btn-del-card" data-id="${exp.id}">${ICONS.trash} Delete</button>
      </div>
    `;

    card.querySelector('.btn-edit-card').addEventListener('click', () => onEdit(exp.id));
    card.querySelector('.btn-dup-card').addEventListener('click', () => onDuplicate(exp.id));
    card.querySelector('.btn-del-card').addEventListener('click', () => onDelete(exp.id));
    cardList.appendChild(card);
  });
}

export function renderModalCategoryPills(selectedCategory = 'Food') {
  const container = document.getElementById('modalCategoryPills');
  const hiddenSelect = document.getElementById('expenseCategory');
  if (!container) return;

  const categoryEmojis = {
    Food: '🍔 Food',
    Travel: '🚗 Travel',
    Shopping: '🛍️ Shopping',
    Education: '🎓 Education',
    Entertainment: '🎬 Cinema',
    Bills: '⚡ Bills',
    Health: '❤️ Health',
    Hostel: '🏠 Hostel',
    Personal: '👤 Personal',
    Other: '••• Other'
  };

  container.innerHTML = CATEGORIES.map(cat => {
    const isSelected = cat.id === selectedCategory;
    const label = categoryEmojis[cat.id] || cat.label;
    return `
      <button type="button" class="select-pill ${isSelected ? 'active' : ''}" data-category="${cat.id}">
        ${label}
      </button>
    `;
  }).join('');

  if (hiddenSelect) hiddenSelect.value = selectedCategory;

  container.querySelectorAll('.select-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.select-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (hiddenSelect) hiddenSelect.value = btn.dataset.category;
    });
  });
}

export function renderModalPaymentPills(selectedPayment = 'UPI') {
  const container = document.getElementById('modalPaymentPills');
  const hiddenSelect = document.getElementById('expensePayment');
  if (!container) return;

  const paymentEmojis = {
    UPI: '📱 UPI',
    Cash: '💵 Cash',
    'Debit Card': '💳 Debit',
    'Credit Card': '💳 Credit',
    'Bank Transfer': '🏦 Transfer',
    Other: '👛 Other'
  };

  container.innerHTML = PAYMENT_METHODS.map(pm => {
    const isSelected = pm.id === selectedPayment;
    const label = paymentEmojis[pm.id] || pm.label;
    return `
      <button type="button" class="select-pill ${isSelected ? 'active' : ''}" data-payment="${pm.id}">
        ${label}
      </button>
    `;
  }).join('');

  if (hiddenSelect) hiddenSelect.value = selectedPayment;

  container.querySelectorAll('.select-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.select-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (hiddenSelect) hiddenSelect.value = btn.dataset.payment;
    });
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Modal Helper
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('modal-active');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal(modalId) {
  if (modalId === 'authModal' && !authService.isAuthenticated()) {
    return; // Entrance gate remains active until a valid email is verified
  }
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('modal-active');
    document.body.style.overflow = '';
  }
}

/**
 * Updates UI header and tools card depending on whether the user is logged in
 */
export function updateAuthUI(user, store) {
  const signInBtn = document.getElementById('googleSignInBtn');
  const profileWrapper = document.getElementById('userProfileWrapper');
  const userAvatarImg = document.getElementById('userAvatarImg');
  const userAvatarInitial = document.getElementById('userAvatarInitial');
  const userDisplayName = document.getElementById('userDisplayName');

  const dropdownAvatarImg = document.getElementById('dropdownAvatarImg');
  const dropdownAvatarInitial = document.getElementById('dropdownAvatarInitial');
  const dropdownUserName = document.getElementById('dropdownUserName');
  const dropdownUserEmail = document.getElementById('dropdownUserEmail');
  const dropdownExpenseCount = document.getElementById('dropdownExpenseCount');

  const toolsAccountTitle = document.getElementById('toolsAccountTitle');
  const toolsAccountDesc = document.getElementById('toolsAccountDesc');
  const toolsAccountBtn = document.getElementById('toolsAccountBtn');

  if (user && user.email) {
    if (signInBtn) signInBtn.style.display = 'none';
    if (profileWrapper) profileWrapper.style.display = 'block';

    const displayName = user.name || user.email.split('@')[0];
    const initial = (displayName.charAt(0) || 'U').toUpperCase();

    if (userDisplayName) {
      userDisplayName.textContent = user.givenName || displayName.split(' ')[0];
    }

    if (user.picture && !user.picture.startsWith('data:image/svg')) {
      if (userAvatarImg) {
        userAvatarImg.src = user.picture;
        userAvatarImg.style.display = 'block';
      }
      if (userAvatarInitial) userAvatarInitial.style.display = 'none';

      if (dropdownAvatarImg) {
        dropdownAvatarImg.src = user.picture;
        dropdownAvatarImg.style.display = 'block';
      }
      if (dropdownAvatarInitial) dropdownAvatarInitial.style.display = 'none';
    } else {
      if (userAvatarImg) userAvatarImg.style.display = 'none';
      if (userAvatarInitial) {
        userAvatarInitial.textContent = initial;
        userAvatarInitial.style.display = 'flex';
      }
      if (dropdownAvatarImg) dropdownAvatarImg.style.display = 'none';
      if (dropdownAvatarInitial) {
        dropdownAvatarInitial.textContent = initial;
        dropdownAvatarInitial.style.display = 'flex';
      }
    }

    if (dropdownUserName) dropdownUserName.textContent = displayName;
    if (dropdownUserEmail) dropdownUserEmail.textContent = user.email;

    if (dropdownExpenseCount && store) {
      const count = store.getUserExpenseCount(user.email);
      dropdownExpenseCount.textContent = count;
    }

    if (toolsAccountTitle) toolsAccountTitle.textContent = displayName;
    if (toolsAccountDesc) toolsAccountDesc.textContent = `Connected as ${user.email}. Your expense records are securely associated with your Gmail identity.`;
    if (toolsAccountBtn) {
      toolsAccountBtn.textContent = 'Switch Account';
    }

    // Tools alerts card
    const toolsAlertEmail = document.getElementById('toolsAlertEmailDisplay');
    if (toolsAlertEmail) toolsAlertEmail.textContent = user.email;

    // Entrance gate modal adjustments when authenticated
    const closeBtn = document.getElementById('authModalCloseBtn');
    const gateBanner = document.getElementById('entranceGateBanner');
    const modalTitle = document.getElementById('authModalTitle');
    const modalSubtitle = document.getElementById('authModalSubtitle');
    if (closeBtn) closeBtn.style.display = 'flex';
    if (gateBanner) gateBanner.style.display = 'none';
    if (modalTitle) modalTitle.textContent = 'Hisabo Account & Alerts';
    if (modalSubtitle) modalSubtitle.textContent = `Connected: ${user.email}`;
  } else {
    if (signInBtn) signInBtn.style.display = 'inline-flex';
    if (profileWrapper) {
      profileWrapper.style.display = 'none';
      const dropdown = document.getElementById('userProfileDropdown');
      if (dropdown) dropdown.classList.remove('active');
    }

    if (toolsAccountTitle) toolsAccountTitle.textContent = 'Real Gmail Account Required';
    if (toolsAccountDesc) toolsAccountDesc.textContent = 'Enter with your compulsory Full Name and real Gmail to access your expenses and activate budget tracking.';
    if (toolsAccountBtn) {
      toolsAccountBtn.textContent = 'Log In / Sign Up to Enter';
    }

    const toolsAlertEmail = document.getElementById('toolsAlertEmailDisplay');
    if (toolsAlertEmail) toolsAlertEmail.textContent = 'Real Gmail required';

    // Entrance gate adjustments when unauthenticated
    const closeBtn = document.getElementById('authModalCloseBtn');
    const gateBanner = document.getElementById('entranceGateBanner');
    const modalTitle = document.getElementById('authModalTitle');
    const modalSubtitle = document.getElementById('authModalSubtitle');
    if (closeBtn) closeBtn.style.display = 'none';
    if (gateBanner) gateBanner.style.display = 'flex';
    if (modalTitle) modalTitle.textContent = 'Log In to Hisabo';
    if (modalSubtitle) modalSubtitle.textContent = 'Real Gmail address & compulsory Full Name required';
  }
}

