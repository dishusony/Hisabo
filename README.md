# Hisabo 💎
> **Smart, Modern & Effortless Monthly Expense Tracker**

Hisabo (inspired by *Hisab* — bookkeeping & computation) is a modern, responsive personal finance and monthly expense tracking web application. It is designed to be fast, private, and effortless to use with 1-tap logging, dynamic budget analytics, and curated luxury visual themes.

---

## ✨ Key Features

- 📋 **Effortless Expense Logging**:
  - 1-tap category and payment method pills (`🍔 Food`, `🚗 Travel`, `🛍️ Shopping`, `📱 UPI`, `💵 Cash`, `💳 Cards`).
  - Large ₹ amount field with auto-focus for rapid entry in under 5 seconds.
  - Complete CRUD support (Add, Edit, Duplicate with today's date, and Delete).

- 🎯 **Dynamic Monthly Budget Tracking**:
  - Set custom target spending limits per month.
  - Automatic calculation: `Remaining Budget = Monthly Budget − Total Expenses`.
  - Color-coded progress bar (Green for healthy, Amber for caution >80%, Red warning banner for exceeded budget).

- 📊 **Visual Analytics (Chart.js)**:
  1. **Expenses by Category**: Donut chart with category percentages and vibrant colors.
  2. **Payment Method Share**: Doughnut chart comparing UPI, Cards, Cash, and Net Banking.
  3. **Daily Spending Trend**: Smooth spline area chart tracking daily spending spikes.
  4. **Monthly Expense Comparison**: Bar chart comparing historical months against designated targets.

- 🎨 **5 Curated Luxury Themes**:
  - 💎 **Emerald Wealth (Default)**: Deep jade obsidian with radiant emerald green and gold accents.
  - 🌌 **Midnight Cyber**: Deep space obsidian with neon indigo & violet cyber glow.
  - 🍇 **Royal Amethyst**: Imperial velvet purple with neon magenta highlights.
  - 🌊 **Ocean Sapphire**: Marine abyss navy with electric cyan & sky blue.
  - ☀️ **Pearl Minimal**: Crisp, clean studio light mode with frosted glass cards.

- 🔍 **Instant Search & Category Filter Chips**:
  - Filter transactions instantly with one click (`All`, `Food`, `Travel`, `Shopping`, `Bills`, etc.).
  - Search by item name or notes.
  - Sort by date (Newest/Oldest) and amount (Highest/Lowest).

- 📥 **Data Portability & 100% Privacy**:
  - Runs entirely on client-side **LocalStorage** — zero data leaves your device.
  - **Export to CSV**: Download monthly records into clean spreadsheet format.
  - **Import from CSV**: Restore or upload transactions from Excel, Google Sheets, or backup.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, Modern Vanilla CSS3 with CSS Custom Properties, ES6 Modular JavaScript
- **Typography**: [Outfit](https://fonts.google.com/specimen/Outfit) (Brand & Headings) + [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (Clean UI) with tabular numbers (`tnum`)
- **Visuals**: [Chart.js](https://www.chartjs.org/) via CDN
- **Icons**: Inline SVG Icons (100% offline self-contained)

---

## 🚀 Getting Started

### Method 1: Direct File
Simply open `index.html` in any modern web browser (Chrome, Edge, Firefox, Brave, Safari).

### Method 2: Local Server
```bash
# Clone the repository
git clone https://github.com/dishusony/Hisabo.git
cd Hisabo

# Serve using npx or python
npx serve . -l 3000
# or
python -m http.server 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License
MIT License © 2026 Hisabo
