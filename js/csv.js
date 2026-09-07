/**
 * csv.js - Robust CSV Import and Export
 * Supports RFC 4180 compliant CSV serialization and deserialization
 */

export function exportExpensesToCSV(expenses, filename = 'expenses.csv') {
  if (!expenses || expenses.length === 0) {
    throw new Error('No expenses available to export');
  }

  const headers = ['Date', 'Item', 'Amount (INR)', 'Payment Method', 'Category', 'Notes'];

  const rows = expenses.map(exp => [
    formatCSVCell(exp.date),
    formatCSVCell(exp.item),
    exp.amount.toFixed(2),
    formatCSVCell(exp.paymentMethod),
    formatCSVCell(exp.category),
    formatCSVCell(exp.notes || '')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatCSVCell(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Parses raw CSV string into structured expense objects
 * Handles quoted fields containing commas and quotes
 */
export function parseCSV(csvText) {
  const lines = parseCSVRows(csvText);
  if (lines.length < 2) {
    throw new Error('CSV file is empty or missing data rows');
  }

  const headerRow = lines[0].map(h => h.trim().toLowerCase());
  
  // Find indices for expected columns
  const dateIdx = headerRow.findIndex(h => h.includes('date'));
  const itemIdx = headerRow.findIndex(h => h.includes('item') || h.includes('name') || h.includes('title') || h.includes('description') && !h.includes('note'));
  const amountIdx = headerRow.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('price') || h.includes('inr') || h.includes('₹'));
  const methodIdx = headerRow.findIndex(h => h.includes('payment') || h.includes('method') || h.includes('mode'));
  const categoryIdx = headerRow.findIndex(h => h.includes('category') || h.includes('purpose'));
  const notesIdx = headerRow.findIndex(h => h.includes('note') || h.includes('comment') || h.includes('remark'));

  if (dateIdx === -1 || itemIdx === -1 || amountIdx === -1) {
    throw new Error('CSV must contain at least "Date", "Item", and "Amount" columns');
  }

  const validExpenses = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
      continue; // Skip blank lines
    }

    const rawDate = row[dateIdx] ? row[dateIdx].trim() : '';
    const rawItem = row[itemIdx] ? row[itemIdx].trim() : '';
    const rawAmount = row[amountIdx] ? row[amountIdx].trim().replace(/[^0-9.-]+/g, '') : '';
    const rawMethod = methodIdx !== -1 && row[methodIdx] ? row[methodIdx].trim() : 'Other';
    const rawCat = categoryIdx !== -1 && row[categoryIdx] ? row[categoryIdx].trim() : 'Other';
    const rawNotes = notesIdx !== -1 && row[notesIdx] ? row[notesIdx].trim() : '';

    if (!rawDate) {
      errors.push(`Row ${i + 1}: Missing date`);
      continue;
    }
    if (!rawItem) {
      errors.push(`Row ${i + 1}: Missing item name`);
      continue;
    }

    const parsedAmount = parseFloat(rawAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.push(`Row ${i + 1}: Invalid positive amount "${row[amountIdx]}"`);
      continue;
    }

    // Standardize date format to YYYY-MM-DD
    const standardDate = normalizeDate(rawDate);
    if (!standardDate) {
      errors.push(`Row ${i + 1}: Unrecognized date format "${rawDate}". Use YYYY-MM-DD or DD/MM/YYYY`);
      continue;
    }

    validExpenses.push({
      date: standardDate,
      item: rawItem,
      amount: Math.round(parsedAmount * 100) / 100,
      paymentMethod: normalizePaymentMethod(rawMethod),
      category: normalizeCategory(rawCat),
      notes: rawNotes
    });
  }

  return {
    validExpenses,
    errors,
    totalRows: lines.length - 1,
    successCount: validExpenses.length
  };
}

function parseCSVRows(text) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF after CR
      }
      currentRow.push(currentVal);
      rows.push(currentRow);
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }

  return rows;
}

function normalizeDate(str) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  // Try Date.parse
  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    const d = new Date(timestamp);
    return d.toISOString().split('T')[0];
  }
  return null;
}

function normalizeCategory(cat) {
  const allowed = ['Food', 'Travel', 'Shopping', 'Education', 'Entertainment', 'Bills', 'Health', 'Hostel', 'Personal', 'Other'];
  const found = allowed.find(c => c.toLowerCase() === cat.toLowerCase().trim());
  return found || 'Other';
}

function normalizePaymentMethod(method) {
  const allowed = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'];
  const lower = method.toLowerCase().trim();
  if (lower.includes('upi') || lower.includes('gpay') || lower.includes('phonepe') || lower.includes('paytm')) return 'UPI';
  if (lower.includes('cash')) return 'Cash';
  if (lower.includes('debit')) return 'Debit Card';
  if (lower.includes('credit')) return 'Credit Card';
  if (lower.includes('bank') || lower.includes('transfer') || lower.includes('neft') || lower.includes('rtgs')) return 'Bank Transfer';
  return 'Other';
}
