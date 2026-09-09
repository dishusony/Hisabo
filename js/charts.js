/**
 * charts.js - Chart.js Visualizations
 * Renders Category Donut, Payment Doughnut, Daily Trend Line, and Monthly Comparison Bar charts.
 */

import { CATEGORIES, PAYMENT_METHODS } from './store.js';

let categoryChartInstance = null;
let paymentChartInstance = null;
let dailyTrendChartInstance = null;
let monthlyComparisonChartInstance = null;

function getChartTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'emerald';
  const isLight = currentTheme === 'pearl' || currentTheme === 'light';

  const themePalettes = {
    emerald: {
      accent: '#10b981',
      pointColor: '#34d399',
      gradientStart: 'rgba(16, 185, 129, 0.45)',
      gradientEnd: 'rgba(16, 185, 129, 0.0)',
      grid: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.2)',
      tooltipBg: '#0a1612',
      tooltipBorder: 'rgba(16, 185, 129, 0.4)'
    },
    midnight: {
      accent: '#6366f1',
      pointColor: '#818cf8',
      gradientStart: 'rgba(99, 102, 241, 0.45)',
      gradientEnd: 'rgba(99, 102, 241, 0.0)',
      grid: 'rgba(99, 102, 241, 0.08)',
      border: 'rgba(99, 102, 241, 0.2)',
      tooltipBg: '#0e1222',
      tooltipBorder: 'rgba(99, 102, 241, 0.4)'
    },
    amethyst: {
      accent: '#a855f7',
      pointColor: '#c084fc',
      gradientStart: 'rgba(168, 85, 247, 0.45)',
      gradientEnd: 'rgba(168, 85, 247, 0.0)',
      grid: 'rgba(168, 85, 247, 0.1)',
      border: 'rgba(168, 85, 247, 0.2)',
      tooltipBg: '#140d22',
      tooltipBorder: 'rgba(168, 85, 247, 0.4)'
    },
    ocean: {
      accent: '#0284c7',
      pointColor: '#38bdf8',
      gradientStart: 'rgba(2, 132, 199, 0.45)',
      gradientEnd: 'rgba(2, 132, 199, 0.0)',
      grid: 'rgba(2, 132, 199, 0.1)',
      border: 'rgba(2, 132, 199, 0.2)',
      tooltipBg: '#08162b',
      tooltipBorder: 'rgba(2, 132, 199, 0.4)'
    },
    pearl: {
      accent: '#059669',
      pointColor: '#10b981',
      gradientStart: 'rgba(16, 185, 129, 0.3)',
      gradientEnd: 'rgba(16, 185, 129, 0.0)',
      grid: 'rgba(0, 0, 0, 0.06)',
      border: 'rgba(0, 0, 0, 0.08)',
      tooltipBg: '#ffffff',
      tooltipBorder: '#cbd5e1'
    }
  };

  const pal = themePalettes[currentTheme] || themePalettes.emerald;

  return {
    isLight,
    accent: pal.accent,
    pointColor: pal.pointColor,
    gradientStart: pal.gradientStart,
    gradientEnd: pal.gradientEnd,
    textColor: isLight ? '#475569' : '#86efac',
    headingColor: isLight ? '#0f172a' : '#f0fdf4',
    gridColor: pal.grid,
    borderColor: pal.border,
    tooltipBg: pal.tooltipBg,
    tooltipText: isLight ? '#0f172a' : '#f8fafc',
    tooltipBorder: pal.tooltipBorder
  };
}

export function initCharts() {
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Outfit', 'Plus Jakarta Sans', -apple-system, sans-serif";
    Chart.defaults.animation = {
      duration: 1100,
      easing: 'easeOutQuart'
    };
    Chart.defaults.transitions = {
      active: {
        animation: {
          duration: 300
        }
      }
    };
  }
}

export function renderCategoryChart(canvasId, breakdown) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;

  const theme = getChartTheme();
  const labels = [];
  const data = [];
  const backgroundColors = [];
  const borderColors = [];

  CATEGORIES.forEach(cat => {
    const val = breakdown[cat.id] || 0;
    if (val > 0) {
      labels.push(cat.label);
      data.push(val);
      backgroundColors.push(cat.color);
      borderColors.push(theme.borderColor);
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
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: theme.textColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            padding: 14,
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
        borderColor: theme.borderColor,
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: theme.textColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            padding: 14,
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

export function renderDailyTrendChart(canvasId, dailyData, monthKey) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;

  const theme = getChartTheme();
  const dates = Object.keys(dailyData).sort();
  const labels = dates.map(d => {
    const day = d.split('-')[2];
    return `${parseInt(day, 10)}`;
  });
  const data = dates.map(d => dailyData[d]);

  if (dailyTrendChartInstance) {
    dailyTrendChartInstance.destroy();
  }

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, theme.gradientStart);
  gradient.addColorStop(1, theme.gradientEnd);

  dailyTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Daily Spend (₹)',
        data: data,
        fill: true,
        backgroundColor: gradient,
        borderColor: theme.accent,
        borderWidth: 2.5,
        tension: 0.35,
        pointBackgroundColor: theme.pointColor,
        pointBorderColor: theme.borderColor,
        pointBorderWidth: 2,
        pointRadius: 3,
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
          },
          title: {
            display: true,
            text: 'Day of the Month',
            color: theme.textColor,
            font: { size: 11 }
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
            title: function(items) {
              const day = items[0].label;
              return `Day ${day} (${monthKey}-${day.padStart(2, '0')})`;
            },
            label: function(context) {
              return ` Spent: ₹${context.parsed.y.toLocaleString('en-IN')}`;
            }
          }
        }
      }
    }
  });
}

export function renderMonthlyComparisonChart(canvasId, comparisonData) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;

  const theme = getChartTheme();
  const labels = comparisonData.map(d => d.label);
  const spentData = comparisonData.map(d => d.totalSpent);
  const budgetData = comparisonData.map(d => d.budget);

  if (monthlyComparisonChartInstance) {
    monthlyComparisonChartInstance.destroy();
  }

  monthlyComparisonChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Total Spent',
          data: spentData,
          backgroundColor: theme.accent,
          borderRadius: 6,
          barPercentage: 0.65,
          categoryPercentage: 0.7
        },
        {
          label: 'Budget Limit',
          data: budgetData,
          backgroundColor: 'rgba(16, 185, 129, 0.45)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.65,
          categoryPercentage: 0.7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: theme.textColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
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
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: theme.textColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            boxWidth: 12,
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
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ₹${context.parsed.y.toLocaleString('en-IN')}`;
            }
          }
        }
      }
    }
  });
}

export function refreshAllCharts(store) {
  const monthKey = store.getSelectedMonth();
  const categoryBreakdown = store.getCategoryBreakdown(monthKey);
  const paymentBreakdown = store.getPaymentMethodBreakdown(monthKey);
  const dailySpending = store.getDailySpending(monthKey);
  const comparisonData = store.getHistoricalMonthlyComparison(6);

  renderCategoryChart('categoryChart', categoryBreakdown);
  renderPaymentChart('paymentChart', paymentBreakdown);
  renderDailyTrendChart('dailyTrendChart', dailySpending, monthKey);
  renderMonthlyComparisonChart('monthlyComparisonChart', comparisonData);
}
