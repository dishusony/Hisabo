/**
 * charts.js - Chart.js Visualizations (Design #7 Fintech Aesthetics)
 * Renders Spending Trend (weekly/monthly/yearly), Category Donut, Payment Method Doughnut,
 * and Analytics Charts with deep dark obsidian surfaces and neon glow effects.
 */

import { CATEGORIES, PAYMENT_METHODS } from './store.js?v=3.2';

let spendingTrendChartInstance = null;
let categoryChartInstance = null;
let paymentChartInstance = null;
let dailyTrendChartInstance = null;
let monthlyComparisonChartInstance = null;
let anTrendChartInstance = null;
let anCategoryBarChartInstance = null;
let anPaymentDonutChartInstance = null;

function getChartTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'midnight';
  const isLight = currentTheme === 'pearl' || currentTheme === 'light';

  // Design #7: Midnight Cyber / Neon Fintech
  return {
    isLight,
    accent: '#00f0ff',
    pointColor: '#38bdf8',
    gradientStart: 'rgba(0, 240, 255, 0.45)',
    gradientEnd: 'rgba(0, 240, 255, 0.0)',
    purpleAccent: '#a855f7',
    pinkAccent: '#ec4899',
    emeraldAccent: '#10b981',
    amberAccent: '#f59e0b',
    textColor: isLight ? '#475569' : '#94a3b8',
    headingColor: isLight ? '#0f172a' : '#f8fafc',
    gridColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)',
    borderColor: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(56, 189, 248, 0.2)',
    tooltipBg: isLight ? '#ffffff' : '#0c122a',
    tooltipText: isLight ? '#0f172a' : '#f8fafc',
    tooltipBorder: isLight ? '#cbd5e1' : 'rgba(0, 240, 255, 0.4)'
  };
}

export function initCharts() {
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Outfit', 'Plus Jakarta Sans', -apple-system, sans-serif";
    Chart.defaults.animation = {
      duration: 800,
      easing: 'easeOutQuart'
    };
    Chart.defaults.transitions = {
      active: {
        animation: {
          duration: 250
        }
      }
    };
  }
}

/**
 * Render Interactive Spending Trend Chart (Dashboard Section 10)
 * Supports Weekly, Monthly, Yearly toggles.
 */
export function renderSpendingTrendChart(canvasId, store, period = 'monthly') {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;

  const theme = getChartTheme();
  let labels = [];
  let data = [];
  let chartType = 'line';

  const monthKey = store.getSelectedMonth();
  const expenses = (typeof store.getMonthExpenses === 'function' ? store.getMonthExpenses(monthKey) : (store.getExpensesForMonth ? store.getExpensesForMonth(monthKey) : [])) || [];

  if (period === 'weekly') {
    // 4 weeks breakdown
    labels = ['Week 1 (1-7)', 'Week 2 (8-14)', 'Week 3 (15-21)', 'Week 4 (22+)'];
    const weekTotals = [0, 0, 0, 0];
    expenses.forEach(e => {
      const day = parseInt(e.date?.split('-')[2] || '1', 10);
      if (day <= 7) weekTotals[0] += Number(e.amount) || 0;
      else if (day <= 14) weekTotals[1] += Number(e.amount) || 0;
      else if (day <= 21) weekTotals[2] += Number(e.amount) || 0;
      else weekTotals[3] += Number(e.amount) || 0;
    });
    data = weekTotals;
    chartType = 'bar';
  } else if (period === 'yearly') {
    // 12 months for year
    const year = monthKey.split('-')[0];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    labels = monthNames;
    const allExpenses = store.getAllExpenses();
    const monthMap = {};
    for (let i = 1; i <= 12; i++) {
      const mk = `${year}-${String(i).padStart(2, '0')}`;
      monthMap[mk] = 0;
    }
    allExpenses.forEach(e => {
      if (e.date && e.date.startsWith(year)) {
        const mk = e.date.substring(0, 7);
        if (monthMap[mk] !== undefined) {
          monthMap[mk] += Number(e.amount) || 0;
        }
      }
    });
    data = Object.values(monthMap);
    chartType = 'bar';
  } else {
    // Monthly (Daily trend for current month)
    const dailyData = store.getDailySpending(monthKey);
    const dates = Object.keys(dailyData).sort();
    labels = dates.map(d => {
      const day = d.split('-')[2];
      return `${parseInt(day, 10)}`;
    });
    data = dates.map(d => dailyData[d]);
    chartType = 'line';
  }

  if (spendingTrendChartInstance) {
    spendingTrendChartInstance.destroy();
  }

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
  gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

  spendingTrendChartInstance = new Chart(ctx, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [{
        label: period === 'weekly' ? 'Weekly Spend (₹)' : period === 'yearly' ? 'Monthly Spend (₹)' : 'Daily Spend (₹)',
        data: data,
        fill: chartType === 'line',
        backgroundColor: chartType === 'line' ? gradient : 'rgba(0, 240, 255, 0.65)',
        borderColor: '#00f0ff',
        borderWidth: 2.5,
        borderRadius: chartType === 'bar' ? 6 : 0,
        tension: 0.35,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#0c122a',
        pointBorderWidth: 2,
        pointRadius: chartType === 'line' ? 3.5 : 0,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: theme.textColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
            maxTicksLimit: 15
          }
        },
        y: {
          grid: { color: theme.gridColor },
          ticks: {
            color: theme.textColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
            callback: value => '₹' + (value >= 1000 ? (value / 1000) + 'k' : value)
          },
          beginAtZero: true
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
              return ` Spent: ₹${Number(val).toLocaleString('en-IN')}`;
            }
          }
        }
      }
    }
  });
}

/**
 * Render Category Breakdown Donut (Dashboard Section 11)
 */
export function renderCategoryChart(canvasId, breakdown) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;

  const theme = getChartTheme();
  const labels = [];
  const data = [];
  const backgroundColors = [];
  const borderColors = [];

  // Design #7 Vibrant Neon Colors
  const categoryNeonPalette = [
    '#00f0ff', '#38bdf8', '#a855f7', '#ec4899', '#f43f5e',
    '#10b981', '#f59e0b', '#6366f1', '#14b8a6', '#eab308'
  ];

  let colorIdx = 0;
  const allCats = store.getCategories ? store.getCategories() : CATEGORIES;
  allCats.forEach(cat => {
    const val = breakdown[cat.id] || 0;
    if (val > 0) {
      labels.push(cat.label || cat.name || cat.id);
      data.push(val);
      backgroundColors.push(cat.color || categoryNeonPalette[colorIdx % categoryNeonPalette.length]);
      borderColors.push('#0c122a');
      colorIdx++;
    }
  });

  const hasData = data.length > 0;
  const chartLabels = hasData ? labels : ['No Expenses'];
  const chartData = hasData ? data : [1];
  const chartColors = hasData ? backgroundColors : [theme.gridColor];

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartData,
        backgroundColor: chartColors,
        borderColor: borderColors,
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: theme.textColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          enabled: hasData,
          callbacks: {
            label: function(context) {
              const val = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ` ${context.label}: ₹${val.toLocaleString('en-IN')} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Render Payment Methods Doughnut
 */
export function renderPaymentChart(canvasId, breakdown) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;

  const theme = getChartTheme();
  const labels = [];
  const data = [];
  const backgroundColors = [];

  PAYMENT_METHODS.forEach(pm => {
    const val = breakdown[pm.id] || 0;
    if (val > 0) {
      labels.push(pm.label);
      data.push(val);
      backgroundColors.push(pm.color);
    }
  });

  const hasData = data.length > 0;
  const chartLabels = hasData ? labels : ['No Transactions'];
  const chartData = hasData ? data : [1];
  const chartColors = hasData ? backgroundColors : [theme.gridColor];

  if (paymentChartInstance) {
    paymentChartInstance.destroy();
  }

  paymentChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartData,
        backgroundColor: chartColors,
        borderColor: '#0c122a',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: theme.textColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          enabled: hasData,
          callbacks: {
            label: function(context) {
              const val = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ` ${context.label}: ₹${val.toLocaleString('en-IN')} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Render Analytics Page Charts (Section 18)
 */
export function renderAnalyticsCharts(store) {
  const monthKey = store.getSelectedMonth();
  const theme = getChartTheme();

  // 1. Expense Trend Line Chart (#anExpenseTrendChart or #anTrendChart)
  const trendCtx = document.getElementById('anExpenseTrendChart') || document.getElementById('anTrendChart');
  if (trendCtx && typeof Chart !== 'undefined') {
    const dailyData = store.getDailySpending(monthKey);
    const dates = Object.keys(dailyData).sort();
    const labels = dates.map(d => parseInt(d.split('-')[2], 10));
    const data = dates.map(d => dailyData[d]);

    if (anTrendChartInstance) anTrendChartInstance.destroy();

    const gradient = trendCtx.getContext('2d').createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.45)');
    gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

    anTrendChartInstance = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Daily Spending (₹)',
          data: data,
          fill: true,
          backgroundColor: gradient,
          borderColor: '#a855f7',
          borderWidth: 2.5,
          tension: 0.35,
          pointBackgroundColor: '#c084fc',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor }
          },
          y: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              callback: value => '₹' + (value >= 1000 ? (value / 1000) + 'k' : value)
            },
            beginAtZero: true
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: '#a855f7',
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ₹${Number(ctx.parsed.y).toLocaleString('en-IN')}`
            }
          }
        }
      }
    });
  }

  // 2. Category Comparison Bar Chart (#anCategoryBarChart)
  const barCtx = document.getElementById('anCategoryBarChart');
  if (barCtx && typeof Chart !== 'undefined') {
    const breakdown = store.getCategoryBreakdown(monthKey);
    const labels = [];
    const data = [];
    const colors = [];

    const allCats = store.getCategories ? store.getCategories() : CATEGORIES;
    allCats.forEach(c => {
      const val = breakdown[c.id] || 0;
      if (val > 0) {
        labels.push(c.label || c.name || c.id);
        data.push(val);
        colors.push(c.color || '#38bdf8');
      }
    });

    if (anCategoryBarChartInstance) anCategoryBarChartInstance.destroy();

    anCategoryBarChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          label: 'Category Spending (₹)',
          data: data.length > 0 ? data : [0],
          backgroundColor: colors.length > 0 ? colors : ['rgba(255,255,255,0.1)'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textColor } },
          y: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              callback: value => '₹' + (value >= 1000 ? (value / 1000) + 'k' : value)
            },
            beginAtZero: true
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ₹${Number(ctx.parsed.y).toLocaleString('en-IN')}`
            }
          }
        }
      }
    });
  }

  // 3. Payment Donut (#anPaymentDonutChart)
  const payCtx = document.getElementById('anPaymentDonutChart');
  if (payCtx && typeof Chart !== 'undefined') {
    const payBreakdown = store.getPaymentMethodBreakdown(monthKey);
    renderPaymentChart('anPaymentDonutChart', payBreakdown);
  }
}

/**
 * Universal refresh for all charts in the active views
 */
export function refreshAllCharts(store, activePeriod = 'monthly') {
  const monthKey = store.getSelectedMonth();
  const categoryBreakdown = store.getCategoryBreakdown(monthKey);
  const paymentBreakdown = store.getPaymentMethodBreakdown(monthKey);

  // Dashboard charts
  renderSpendingTrendChart('spendingTrendChart', store, activePeriod);
  renderCategoryChart('categoryDonutChart', categoryBreakdown);

  // Fallback IDs if present
  renderCategoryChart('categoryChart', categoryBreakdown);
  renderPaymentChart('paymentChart', paymentBreakdown);

  // Analytics charts
  renderAnalyticsCharts(store);
}
