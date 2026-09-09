/**
 * mail.service.js - Gmail Notification Service for Budget Milestone Alerts
 * Handles 50%, 90%, and 100% budget threshold alerts via nodemailer with Gmail SMTP.
 * Gracefully operates in simulation mode if Gmail credentials are not yet configured.
 */

import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { expenseDAO, budgetDAO, budgetAlertDAO } from '../db/db.js';

/**
 * Checks if valid Gmail credentials are provided in process.env
 */
export function isGmailConfigured() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  return Boolean(
    user &&
    pass &&
    !user.includes('your_gmail') &&
    !pass.includes('your_16_char_app_password') &&
    user.trim().length > 0 &&
    pass.trim().length >= 10
  );
}

/**
 * Checks if Brevo (Sendinblue) free REST API is configured (100% Free, 300 emails/day, ₹0 cost)
 */
export function isBrevoConfigured() {
  const key = process.env.BREVO_API_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes('your_brevo_key'));
}

/**
 * Checks if Resend API key is configured
 */
export function isResendConfigured() {
  const key = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes('re_your_api_key'));
}

/**
 * Checks if ANY live transactional email provider is configured
 */
export function isEmailConfigured() {
  return isGmailConfigured() || isBrevoConfigured() || isResendConfigured();
}

/**
 * Sends an email via Brevo REST API (100% Free tier, 300 emails/day, no credit card required)
 */
async function sendViaBrevo({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY.trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || to).trim();
  const senderName = process.env.EMAIL_FROM_NAME || 'Hisabo';

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.message || `HTTP ${response.status} from Brevo`;
    throw new Error(errorMsg);
  }
  return { id: data.messageId || 'brevo-sent' };
}

/**
 * Sends an email via Resend REST API
 */
async function sendViaResend({ to, subject, html, text }) {
  const apiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY).trim();
  const from = process.env.EMAIL_FROM || 'Hisabo <onboarding@resend.dev>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.message || data.error?.message || `HTTP ${response.status} from Resend`;
    throw new Error(errorMsg);
  }
  return { id: data.id };
}

/**
 * Returns configuration status and masked sender email
 */
export function getGmailConfigStatus() {
  const configured = isGmailConfigured();
  let masked = null;
  if (process.env.GMAIL_USER && configured) {
    const email = process.env.GMAIL_USER.trim();
    const [name, domain] = email.split('@');
    masked = (name.length > 2 ? name.substring(0, 2) + '***' : name) + '@' + (domain || 'gmail.com');
  }
  return {
    isConfigured: configured,
    senderEmail: masked
  };
}

/**
 * Persists Gmail credentials to .env file
 */
export function saveGmailCredentialsToEnv(gmailUser, appPassword) {
  const cleanUser = gmailUser.trim().toLowerCase();
  const cleanPass = appPassword.trim().replace(/\s+/g, '');
  process.env.GMAIL_USER = cleanUser;
  process.env.GMAIL_APP_PASSWORD = cleanPass;

  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }

    let userSet = false;
    let passSet = false;
    const lines = content ? content.split(/\r?\n/) : [];
    const newLines = lines.map(line => {
      if (/^\s*#?\s*GMAIL_USER\s*=/i.test(line)) {
        userSet = true;
        return `GMAIL_USER=${cleanUser}`;
      }
      if (/^\s*#?\s*GMAIL_APP_PASSWORD\s*=/i.test(line)) {
        passSet = true;
        return `GMAIL_APP_PASSWORD=${cleanPass}`;
      }
      return line;
    });

    if (!userSet) newLines.push(`GMAIL_USER=${cleanUser}`);
    if (!passSet) newLines.push(`GMAIL_APP_PASSWORD=${cleanPass}`);

    fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
    console.log(`[Hisabo Mail] Saved GMAIL_USER=${cleanUser} into .env successfully.`);
  } catch (err) {
    console.error('[Hisabo Mail] Failed to write to .env:', err.message);
  }

  return { cleanUser, cleanPass };
}

/**
 * Persists Resend API key to .env file
 */
export function saveResendKeyToEnv(apiKey) {
  const cleanKey = apiKey.trim();
  process.env.RESEND_API_KEY = cleanKey;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    let keySet = false;
    const lines = content ? content.split(/\r?\n/) : [];
    const newLines = lines.map(line => {
      if (/^\s*#?\s*RESEND_API_KEY\s*=/i.test(line)) {
        keySet = true;
        return `RESEND_API_KEY=${cleanKey}`;
      }
      return line;
    });
    if (!keySet) newLines.push(`RESEND_API_KEY=${cleanKey}`);
    fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
    console.log('[Hisabo Mail] Saved RESEND_API_KEY into .env successfully.');
  } catch (err) {
    console.error('[Hisabo Mail] Failed to write RESEND_API_KEY to .env:', err.message);
  }
  return { cleanKey };
}

/**
 * Enables local development OTP fallback in .env
 */
export function enableDevModeInEnv() {
  process.env.ALLOW_DEV_FALLBACK = 'true';
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    let set = false;
    const lines = content ? content.split(/\r?\n/) : [];
    const newLines = lines.map(line => {
      if (/^\s*#?\s*ALLOW_DEV_FALLBACK\s*=/i.test(line)) {
        set = true;
        return 'ALLOW_DEV_FALLBACK=true';
      }
      return line;
    });
    if (!set) newLines.push('ALLOW_DEV_FALLBACK=true');
    fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
    console.log('[Hisabo Mail] Enabled ALLOW_DEV_FALLBACK=true in .env.');
  } catch (err) {
    console.error('[Hisabo Mail] Failed to write ALLOW_DEV_FALLBACK to .env:', err.message);
  }
}

/**
 * Tests connection with Google SMTP and saves credentials if verified
 */
export async function verifyAndSaveGmailCredentials(gmailUser, appPassword) {
  if (!gmailUser || !appPassword) {
    throw new Error('Both Gmail address and 16-character App Password are required.');
  }
  const cleanUser = gmailUser.trim().toLowerCase();
  const cleanPass = appPassword.trim().replace(/\s+/g, '');

  if (!cleanUser.endsWith('@gmail.com') && !cleanUser.endsWith('@googlemail.com')) {
    throw new Error('Only valid real Gmail addresses (@gmail.com) are supported for Gmail SMTP.');
  }
  if (cleanPass.length < 10) {
    throw new Error('Google App Passwords are 16 characters (e.g. abcd efgh ijkl mnop). Please check your password.');
  }

  // Test transporter connection
  const testTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: cleanUser,
      pass: cleanPass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  try {
    await testTransporter.verify();
  } catch (err) {
    let reason = err.message;
    if (reason.includes('535') || reason.includes('Username and Password not accepted') || reason.includes('BadCredentials')) {
      reason = 'Google rejected the credentials. Please verify that 2-Step Verification is enabled and you generated a valid App Password from Google Account Security.';
    }
    throw new Error(reason);
  }

  // Persist to .env and process.env
  saveGmailCredentialsToEnv(cleanUser, cleanPass);

  return { success: true, user: cleanUser };
}

/**
 * Creates and returns the nodemailer transporter for Gmail
 */
function createTransporter() {
  if (!isGmailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER.trim(),
      pass: process.env.GMAIL_APP_PASSWORD.trim().replace(/\s+/g, '')
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

/**
 * Formats YYYY-MM to human readable (e.g. 'September 2026')
 */
function formatMonthName(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Returns threshold configuration metadata (colors, badges, titles)
 */
function getThresholdMeta(threshold) {
  switch (threshold) {
    case 50:
      return {
        badge: '50% MILESTONE',
        badgeBg: '#fef3c7',
        badgeColor: '#b45309',
        progressColor: '#f59e0b',
        title: '⚠️ 50% of Your Monthly Budget Used',
        subtitle: "You have used half of your planned spending limit for this month.",
        urgency: 'Informational'
      };
    case 90:
      return {
        badge: '90% WARNING',
        badgeBg: '#ffedd5',
        badgeColor: '#c2410c',
        progressColor: '#f97316',
        title: '🚨 Urgent: 90% of Your Budget Reached',
        subtitle: 'You are approaching your budget limit. Please review discretionary spending.',
        urgency: 'Warning'
      };
    case 100:
    default:
      return {
        badge: '100% LIMIT REACHED',
        badgeBg: '#fee2e2',
        badgeColor: '#b91c1c',
        progressColor: '#ef4444',
        title: '🛑 Critical: 100% of Monthly Budget Consumed',
        subtitle: 'You have reached or exceeded your budgeted expenditure for this month.',
        urgency: 'Critical'
      };
  }
}

/**
 * Generates modern, responsive HTML email template matching Hisabo aesthetic
 */
function generateAlertEmailHtml({ userName, monthKey, threshold, spentAmount, budgetAmount }) {
  const meta = getThresholdMeta(threshold);
  const monthName = formatMonthName(monthKey);
  const percentUsed = Math.min(100, Math.round((spentAmount / budgetAmount) * 100));
  const remaining = Math.max(0, budgetAmount - spentAmount);
  const overspend = Math.max(0, spentAmount - budgetAmount);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #f8fafc; }
    .container { max-width: 580px; margin: 30px auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; }
    .brand { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; margin: 0 0 6px 0; }
    .tagline { font-size: 13px; color: #e0e7ff; margin: 0; opacity: 0.9; }
    .body { padding: 32px 28px; }
    .badge { display: inline-block; padding: 6px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; border-radius: 9999px; background-color: ${meta.badgeBg}; color: ${meta.badgeColor}; margin-bottom: 16px; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 8px 0; }
    .desc { font-size: 14px; color: #94a3b8; line-height: 1.5; margin: 0 0 24px 0; }
    .stats-card { background: #0f172a; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px; }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
    .stat-label { color: #94a3b8; }
    .stat-val { font-weight: 700; color: #f8fafc; }
    .progress-wrap { margin-top: 14px; }
    .progress-labels { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
    .progress-bar-bg { width: 100%; height: 10px; background: #334155; border-radius: 9999px; overflow: hidden; }
    .progress-bar-fill { height: 100%; width: ${percentUsed}%; background: ${meta.progressColor}; border-radius: 9999px; }
    .summary-text { font-size: 13px; color: #cbd5e1; line-height: 1.6; margin-bottom: 24px; }
    .footer { background: #0f172a; padding: 20px 28px; text-align: center; border-top: 1px solid #334155; font-size: 12px; color: #64748b; }
    .footer a { color: #818cf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">💰 Hisabo</div>
      <div class="tagline">Smart Expense Tracker & Budget Manager</div>
    </div>
    <div class="body">
      <div class="badge">${meta.badge}</div>
      <h2 class="title">${meta.title}</h2>
      <p class="desc">Hi <strong>${userName || 'Friend'}</strong>, ${meta.subtitle}</p>

      <div class="stats-card">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">Period</td>
            <td style="padding: 6px 0; color: #f8fafc; font-size: 14px; font-weight: 600; text-align: right;">${monthName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">Total Budget</td>
            <td style="padding: 6px 0; color: #f8fafc; font-size: 14px; font-weight: 600; text-align: right;">₹${Math.round(budgetAmount).toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">Total Spent</td>
            <td style="padding: 6px 0; color: ${meta.progressColor}; font-size: 14px; font-weight: 700; text-align: right;">₹${Math.round(spentAmount).toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">${overspend > 0 ? 'Over Budget By' : 'Remaining Balance'}</td>
            <td style="padding: 6px 0; color: ${overspend > 0 ? '#ef4444' : '#10b981'}; font-size: 14px; font-weight: 700; text-align: right;">₹${Math.round(overspend > 0 ? overspend : remaining).toLocaleString('en-IN')}</td>
          </tr>
        </table>

        <div class="progress-wrap">
          <div class="progress-labels">
            <span>Budget Consumed</span>
            <span style="font-weight: 700; color: ${meta.progressColor};">${Math.round((spentAmount / budgetAmount) * 100)}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill"></div>
          </div>
        </div>
      </div>

      <p class="summary-text">
        ${threshold === 100
          ? 'You have reached your total budget ceiling for this month. All subsequent expenses will represent an overspend.'
          : threshold === 90
            ? 'Only 10% of your budget remains. Consider reviewing upcoming recurring bills and postponing non-essential purchases.'
            : 'You have utilized half of your allocated funds for this month. Keeping an eye on your expenses now will help you finish the month on track.'}
      </p>
    </div>
    <div class="footer">
      This automated alert was sent by <strong>Hisabo Smart Expense Monitor</strong> to ${userName ? userName + ' &lt;' : ''}${userName ? '&gt;' : ''}.<br>
      To manage your notifications and budgets, sign into your Hisabo dashboard.
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Sends a single budget alert email to the recipient
 */
export async function sendBudgetAlert({ toEmail, userName, monthKey, threshold, spentAmount, budgetAmount }) {
  const meta = getThresholdMeta(threshold);
  const monthName = formatMonthName(monthKey);
  const subject = `${meta.title} (${monthName})`;

  if (!isGmailConfigured()) {
    console.log(
      `[Hisabo Mail] ℹ️ SIMULATED GMAIL ALERT [${threshold}%]: To: ${toEmail} | Month: ${monthKey} | Spent: ₹${spentAmount} / ₹${budgetAmount}. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env for live email delivery.`
    );
    return {
      success: true,
      simulated: true,
      threshold,
      toEmail,
      subject
    };
  }

  try {
    const transporter = createTransporter();
    const htmlContent = generateAlertEmailHtml({ userName, monthKey, threshold, spentAmount, budgetAmount });
    const textFallback = `${meta.title}\n\nHi ${userName || 'Friend'},\n${meta.subtitle}\n\nPeriod: ${monthName}\nBudget: ₹${budgetAmount}\nSpent: ₹${spentAmount}\nPercent Used: ${Math.round((spentAmount / budgetAmount) * 100)}%\n\nSent automatically by Hisabo.`;

    const info = await transporter.sendMail({
      from: `"Hisabo Alerts" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject,
      text: textFallback,
      html: htmlContent
    });

    console.log(`[Hisabo Mail] ✅ Sent ${threshold}% budget alert to ${toEmail} (Message ID: ${info.messageId})`);
    return {
      success: true,
      simulated: false,
      threshold,
      toEmail,
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[Hisabo Mail] ❌ Failed to send ${threshold}% alert to ${toEmail}:`, err.message);
    return {
      success: false,
      simulated: false,
      threshold,
      toEmail,
      error: err.message
    };
  }
}

/**
 * Sends a test email to verify Gmail SMTP configuration
 */
export async function sendTestEmail({ toEmail, userName = 'Hisabo User' }) {
  if (!toEmail) {
    return { success: false, error: 'Recipient email is required' };
  }

  const currentMonthKey = new Date().toISOString().substring(0, 7);
  const testThreshold = 50;
  const testBudget = 25000;
  const testSpent = 12500;

  if (!isGmailConfigured()) {
    console.log(`[Hisabo Mail] ℹ️ SIMULATED TEST EMAIL to ${toEmail}. Configure GMAIL_USER and GMAIL_APP_PASSWORD in .env to send real emails.`);
    return {
      success: true,
      simulated: true,
      message: 'Gmail credentials not configured in .env. Test notification logged in simulation mode.'
    };
  }

  try {
    const transporter = createTransporter();
    const html = generateAlertEmailHtml({
      userName,
      monthKey: currentMonthKey,
      threshold: testThreshold,
      spentAmount: testSpent,
      budgetAmount: testBudget
    });

    const info = await transporter.sendMail({
      from: `"Hisabo Alerts" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: `🧪 Hisabo Gmail Test: Budget Notification Service Working!`,
      text: `Hello ${userName},\n\nThis is a test email confirming that Hisabo's Gmail notification service is properly configured and operational!\n\nYou will receive automated alerts when your monthly spending reaches 50%, 90%, and 100% of your budget.`,
      html
    });

    return {
      success: true,
      simulated: false,
      message: `Test email successfully sent to ${toEmail}`,
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[Hisabo Mail] ❌ Test email failed:`, err.message);
    return {
      success: false,
      simulated: false,
      error: err.message
    };
  }
}

/**
 * Core alert evaluation engine:
 * Calculates spending for the specified month and triggers emails for any newly crossed thresholds (50%, 90%, 100%).
 */
export async function checkAndTriggerBudgetAlerts(userId, monthKey, userEmail, userName) {
  if (!userId || !monthKey || !userEmail) {
    return { error: 'Missing parameters for budget check', alertsTriggered: [] };
  }

  const budgetAmount = budgetDAO.getForMonth(userId, monthKey);
  if (!budgetAmount || budgetAmount <= 0) {
    return { spentAmount: 0, budgetAmount: 0, percent: 0, alertsTriggered: [] };
  }

  // Calculate current spent amount from SQLite
  const expenses = expenseDAO.getAll(userId, { month: monthKey });
  const spentAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const percent = (spentAmount / budgetAmount) * 100;

  const thresholds = [50, 90, 100];
  const alertsTriggered = [];

  const realMailActive = isGmailConfigured();

  for (const threshold of thresholds) {
    if (percent >= threshold) {
      // If real mail is active, check if a REAL email was sent (is_simulated = 0)
      // If real mail is inactive, check if simulation was already recorded to avoid terminal spam
      const alreadySent = budgetAlertDAO.hasAlertBeenSent(userId, monthKey, threshold, !realMailActive);
      if (!alreadySent) {
        // Send email
        const mailResult = await sendBudgetAlert({
          toEmail: userEmail,
          userName: userName || userEmail.split('@')[0],
          monthKey,
          threshold,
          spentAmount,
          budgetAmount
        });

        // Record in database with accurate simulation status
        budgetAlertDAO.recordAlert({
          userId,
          monthKey,
          threshold,
          spentAmount,
          budgetAmount,
          recipientEmail: userEmail,
          isSimulated: mailResult.simulated ? 1 : 0
        });

        alertsTriggered.push({
          threshold,
          spentAmount,
          budgetAmount,
          ...mailResult
        });
      }
    }
  }

  return {
    monthKey,
    spentAmount,
    budgetAmount,
    percent: Math.round(percent * 10) / 10,
    alertsTriggered
  };
}

/**
 * Generates responsive HTML email for Gmail OTP verification
 */
function generateOtpEmailHtml({ userName, otpCode, expiresMinutes = 10 }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your Gmail - Hisabo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #f8fafc; }
    .container { max-width: 540px; margin: 30px auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #10b981 0%, #0284c7 100%); padding: 32px 24px; text-align: center; }
    .brand { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; margin: 0 0 6px 0; }
    .tagline { font-size: 13px; color: #e0e7ff; margin: 0; opacity: 0.9; }
    .body { padding: 32px 28px; text-align: center; }
    .badge { display: inline-block; padding: 6px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; border-radius: 9999px; background-color: #d1fae5; color: #065f46; margin-bottom: 16px; text-transform: uppercase; }
    .title { font-size: 22px; font-weight: 700; color: #f8fafc; margin: 0 0 10px 0; }
    .desc { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 28px 0; }
    .otp-card { background: #0f172a; border-radius: 14px; padding: 24px; border: 1px solid #334155; margin: 0 auto 28px auto; display: inline-block; min-width: 240px; }
    .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #10b981; margin: 0; padding-left: 12px; }
    .expiry-note { font-size: 13px; color: #f59e0b; margin-top: 10px; font-weight: 600; display: block; }
    .security-notice { font-size: 13px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #334155; padding-top: 20px; margin-top: 10px; text-align: left; }
    .security-notice strong { color: #f87171; }
    .footer { background: #0f172a; padding: 20px 28px; text-align: center; border-top: 1px solid #334155; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">💰 Hisabo</div>
      <div class="tagline">Smart Expense Tracker & Budget Manager</div>
    </div>
    <div class="body">
      <div class="badge">SECURITY VERIFICATION</div>
      <h2 class="title">Verify your Gmail</h2>
      <p class="desc">
        Hi <strong>${userName || 'there'}</strong>,<br>
        Thank you for joining Hisabo. Please enter the 6-digit verification code below to confirm that this Gmail belongs to you and complete your registration.
      </p>

      <div class="otp-card">
        <div class="otp-code">${otpCode}</div>
        <span class="expiry-note">⏳ Expires in ${expiresMinutes} minutes</span>
      </div>

      <div class="security-notice">
        <strong>⚠️ Security Warning:</strong> Do not share this verification code with anyone. Hisabo will never ask you for this code. If you did not initiate this registration request, please disregard this email.
      </div>
    </div>
    <div class="footer">
      Sent automatically by <strong>Hisabo Security</strong> &bull; Protected by Strict Gmail Verification
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Sends a 6-digit OTP verification email to the user's Gmail.
 * Enforces REAL email delivery via Google Gmail SMTP, Brevo REST API, or Resend.
 * Throws an explicit error if no provider is configured or if delivery fails.
 * NEVER simulates, mocks, or exposes OTPs.
 */
export async function sendVerificationOtpEmail({ toEmail, userName = '', otpCode, expiresMinutes = 10 }) {
  if (!toEmail || !otpCode) {
    throw new Error('Recipient email and OTP code are required.');
  }

  const subject = 'Verify your Gmail';
  const htmlContent = generateOtpEmailHtml({ userName, otpCode, expiresMinutes });
  const textFallback = `Hisabo - Verify your Gmail\n\nYour 6-digit verification code is: ${otpCode}\n\nThis verification code will expire in ${expiresMinutes} minutes.\n\nSecurity Notice: Do NOT share this verification code with anyone. Hisabo staff will never ask for your code.\n\nIf you did not request this verification, please safely ignore this email.`;

  // 1. Google Gmail SMTP via Nodemailer (₹0, 500 emails/day, direct inbox delivery)
  if (isGmailConfigured()) {
    try {
      const transporter = createTransporter();
      const sender = process.env.GMAIL_USER.trim();
      const info = await transporter.sendMail({
        from: `"Hisabo" <${sender}>`,
        to: toEmail,
        subject,
        text: textFallback,
        html: htmlContent
      });

      console.log(`[Hisabo Mail] ✅ Sent verification OTP to ${toEmail} via Gmail SMTP (Message ID: ${info.messageId})`);
      return {
        success: true,
        provider: 'smtp',
        messageId: info.messageId,
        toEmail
      };
    } catch (err) {
      console.error(`[Hisabo Mail] ❌ Gmail SMTP delivery failed for ${toEmail}:`, err.message);
      // If Brevo or Resend is also configured, fall through; otherwise throw explicit error
      if (!isBrevoConfigured() && !isResendConfigured()) {
        throw new Error(`Failed to deliver verification email via Gmail SMTP: ${err.message}`);
      }
    }
  }

  // 2. Brevo (Sendinblue) Free REST API (₹0, 300 emails/day, no credit card required)
  if (isBrevoConfigured()) {
    try {
      const brevoRes = await sendViaBrevo({
        to: toEmail,
        subject,
        html: htmlContent,
        text: textFallback
      });
      console.log(`[Hisabo Mail] ✅ Sent verification OTP to ${toEmail} via Brevo API (ID: ${brevoRes.id})`);
      return {
        success: true,
        provider: 'brevo',
        id: brevoRes.id,
        toEmail
      };
    } catch (err) {
      console.error(`[Hisabo Mail] ❌ Brevo delivery failed for ${toEmail}:`, err.message);
      if (!isResendConfigured()) {
        throw new Error(`Failed to deliver verification email via Brevo: ${err.message}`);
      }
    }
  }

  // 3. Resend REST API (if user configured a custom domain or Resend API key)
  if (isResendConfigured()) {
    try {
      const resendRes = await sendViaResend({
        to: toEmail,
        subject,
        html: htmlContent,
        text: textFallback
      });
      console.log(`[Hisabo Mail] ✅ Sent verification OTP to ${toEmail} via Resend (ID: ${resendRes.id})`);
      return {
        success: true,
        provider: 'resend',
        id: resendRes.id,
        toEmail
      };
    } catch (err) {
      console.error(`[Hisabo Mail] ❌ Resend delivery failed for ${toEmail}:`, err.message);
      throw new Error(`Failed to deliver verification email via Resend: ${err.message}`);
    }
  }

  // 4. Strict: Throw explicit error if no live delivery service is configured.
  // NEVER pretend an email was sent, and NEVER return mock codes.
  console.error(`[Hisabo Mail] ❌ Cannot send OTP to ${toEmail}: No live email provider configured.`);
  throw new Error('Email delivery service not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD (16-character Google App Password) or BREVO_API_KEY in your environment variables to enable real OTP delivery.');
}
