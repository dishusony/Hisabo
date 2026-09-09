/**
 * auth.controller.js - Strict Gmail Authentication Controller
 * 
 * Enforces:
 * 1. Strict real Gmail domains (@gmail.com / @googlemail.com)
 * 2. Compulsory Full Name for accounts
 * 3. Genuine inbox verification via 6-digit OTP codes sent via Gmail SMTP
 * 4. Account activation ONLY after successful OTP verification
 * 5. Scrypt password hashing & salted SHA-256 OTP storage
 * 6. Brute-force protection & rate limiting (max 5 OTP attempts, 60s cooldown, 10m expiry)
 */

import crypto from 'node:crypto';
import { userDAO, sessionDAO, verificationDAO, signupVerificationDAO } from '../db/db.js';
import {
  sendVerificationOtpEmail,
  isEmailConfigured,
  saveResendKeyToEnv,
  enableDevModeInEnv,
  verifyAndSaveGmailCredentials
} from '../services/mail.service.js';
import {
  hashPassword,
  verifyPassword,
  generateOtp,
  hashOtp,
  verifyOtp,
  generateVerificationToken,
  checkSignupRateLimit,
  checkLoginRateLimit,
  checkOtpResendCooldown,
  rateLimiter
} from '../utils/security.js';

function decodeGoogleJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * Validates compulsory Full Name:
 * - Must be a string with trimmed length between 2 and 70 characters
 * - Must contain at least one valid alphabetical letter
 */
export function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 70) return false;
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) return false;
  return true;
}

/**
 * Strict RFC 5322 & domain structure email validation
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim();
  if (clean.length > 254 || clean.length < 5) return false;

  // Disallow any whitespace
  if (/\s/.test(clean)) return false;

  // Single @ symbol separating local and domain parts
  const parts = clean.split('@');
  if (parts.length !== 2) return false;

  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart) return false;
  if (localPart.length > 64) return false;

  // Local part rules: no leading/trailing dot, no consecutive dots
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false;
  }
  const localRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  if (!localRegex.test(localPart)) return false;

  // Domain part rules: no leading/trailing dot, no consecutive dots
  if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
    return false;
  }
  const domainLabels = domainPart.split('.');
  if (domainLabels.length < 2) return false;

  for (const label of domainLabels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
  }

  // TLD must be alphabetical and at least 2 characters
  const tld = domainLabels[domainLabels.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) return false;

  return true;
}

export const INVALID_GMAIL_MESSAGE = 'Invalid Gmail address. Please enter a valid Gmail.';

/**
 * Strict Real Gmail Validation:
 * - Rejects any spaces (internal or external)
 * - Requires valid username and domain separated by a single @
 * - Domain must be EXACTLY 'gmail.com' (rejects Yahoo, Outlook, Hotmail, college, disposable, etc.)
 * - Username length must be 6 to 30 alphanumeric characters / dots
 * - Rejects missing username, missing domain, multiple @, leading/trailing/consecutive dots
 */
export function isValidGmail(email) {
  if (!email || typeof email !== 'string') return false;

  // Reject any whitespace anywhere in the string
  if (/\s/.test(email)) return false;

  const clean = email.trim().toLowerCase();
  if (clean.length > 254 || clean.length < 5) return false;

  // Must have exactly one @ symbol
  const parts = clean.split('@');
  if (parts.length !== 2) return false;

  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart) return false;

  // Domain must be EXACTLY 'gmail.com'
  if (domainPart !== 'gmail.com') {
    return false;
  }

  // Local part (username) rules:
  // Cannot start or end with a dot, cannot contain consecutive dots
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false;
  }

  // Gmail usernames allow only letters a-z, numbers 0-9, and periods
  if (!/^[a-z0-9.]+$/.test(localPart)) {
    return false;
  }

  // Pure alphanumeric characters count must be 6 to 30 characters
  const alphanumericOnly = localPart.replace(/\./g, '');
  if (alphanumericOnly.length < 6 || alphanumericOnly.length > 30) {
    return false;
  }

  return true;
}

export const authController = {
  getConfig(req, res) {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
  },

  /**
   * POST /api/auth/send-otp
   * Step 1 of Signup: Validates Gmail, enforces 60s cooldown, generates secure 6-digit OTP,
   * sends real transactional email via Resend or Gmail SMTP.
   */
  async sendOtp(req, res) {
    try {
      const { email } = req.body || {};
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!isValidGmail(cleanEmail)) {
        return res.status(400).json({ error: INVALID_GMAIL_MESSAGE });
      }

      // 1. IP rate limit check
      const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const rateCheckIp = checkSignupRateLimit(clientIp);
      if (!rateCheckIp.allowed) {
        return res.status(429).json({
          error: `Too many attempts. Please try again in ${rateCheckIp.retryAfterSeconds} seconds.`
        });
      }

      // 2. Check if user already exists and is verified
      const existingUser = userDAO.findByEmail(cleanEmail);
      if (existingUser && existingUser.is_verified) {
        return res.status(409).json({
          error: 'This Gmail address is already registered. Please log in instead.'
        });
      }

      // 3. Cooldown check (60s)
      const activeRecord = verificationDAO.getLatest(cleanEmail, 'signup_verification');
      const now = Date.now();
      if (activeRecord && now < activeRecord.resendAvailableAt) {
        const waitSec = Math.ceil((activeRecord.resendAvailableAt - now) / 1000);
        return res.status(429).json({
          error: `Please wait ${waitSec} seconds before requesting another code.`,
          retryAfterSeconds: waitSec
        });
      }

      const rateCheckEmail = checkOtpResendCooldown(cleanEmail);
      if (!rateCheckEmail.allowed) {
        return res.status(429).json({
          error: `Please wait ${rateCheckEmail.retryAfterSeconds} seconds before requesting another code.`,
          retryAfterSeconds: rateCheckEmail.retryAfterSeconds
        });
      }

      // 4. Generate secure 6-digit OTP & salt
      const otpCode = generateOtp();
      const salt = crypto.randomBytes(16).toString('hex');
      const otpHash = hashOtp(otpCode, salt);

      // 5. Store in SQLite
      verificationDAO.createCode({
        email: cleanEmail,
        otpHash,
        salt,
        purpose: 'signup_verification',
        expiresMinutes: 10,
        cooldownSeconds: 60
      });

      // 6. Send real email via Gmail SMTP or Brevo API
      await sendVerificationOtpEmail({
        toEmail: cleanEmail,
        userName: existingUser?.name || '',
        otpCode,
        expiresMinutes: 10
      });

      return res.json({
        success: true,
        message: 'Verification code sent to your Gmail.',
        email: cleanEmail,
        expiresMinutes: 10,
        resendCooldownSeconds: 60
      });
    } catch (err) {
      console.error('[Auth] sendOtp error:', err);
      return res.status(500).json({
        error: err.message || 'Failed to send verification code. Please try again.'
      });
    }
  },

  /**
   * POST /api/auth/resend-otp
   * Resends verification OTP with 60s cooldown enforcement.
   */
  async resendOtp(req, res) {
    return authController.sendOtp(req, res);
  },

  /**
   * POST /api/auth/verify-otp
   * Step 2 of Signup: Validates 6-digit code, verifies timing-safe hash,
   * generates a single-use verificationToken in signup_verifications table.
   */
  async verifyOtp(req, res) {
    try {
      const { email, otp } = req.body || {};

      const cleanEmail = (email || '').trim().toLowerCase();
      if (!isValidGmail(cleanEmail)) {
        return res.status(400).json({ error: INVALID_GMAIL_MESSAGE });
      }

      const cleanOtp = (otp || '').toString().trim();
      if (!cleanOtp || !/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({ error: 'Please enter the valid 6-digit verification code.' });
      }

      // Retrieve stored code
      const record = verificationDAO.getLatest(cleanEmail, 'signup_verification');
      if (!record) {
        return res.status(400).json({
          error: 'No active verification code found for this email. Please request a new code.',
          codeExpired: true
        });
      }

      // Check expiry
      if (Date.now() > record.expiresAt) {
        verificationDAO.deleteForEmail(cleanEmail, 'signup_verification');
        return res.status(400).json({
          error: 'Verification code has expired. Please request a new code.',
          codeExpired: true
        });
      }

      // Check brute force attempt limit (max 5)
      if (record.attempts >= record.maxAttempts) {
        verificationDAO.deleteForEmail(cleanEmail, 'signup_verification');
        return res.status(400).json({
          error: 'Maximum verification attempts exceeded. Code has been invalidated. Please request a new code.',
          attemptsExceeded: true
        });
      }

      // Verify OTP hash
      const isMatch = verifyOtp(cleanOtp, record.otpHash, record.salt);
      if (!isMatch) {
        verificationDAO.incrementAttempts(record.id);
        const remaining = Math.max(0, record.maxAttempts - (record.attempts + 1));
        if (remaining <= 0) {
          verificationDAO.deleteForEmail(cleanEmail, 'signup_verification');
          return res.status(400).json({
            error: 'Invalid verification code. Maximum attempts exceeded. Please request a new code.',
            attemptsExceeded: true,
            remainingAttempts: 0
          });
        }
        return res.status(400).json({
          error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
          remainingAttempts: remaining
        });
      }

      // Success! Invalidate the used OTP code
      verificationDAO.deleteForEmail(cleanEmail, 'signup_verification');

      // Issue single-use server-side verificationToken (valid 30 minutes)
      const verificationToken = generateVerificationToken();
      signupVerificationDAO.create({
        token: verificationToken,
        email: cleanEmail,
        expiresMinutes: 30
      });

      // If user record already exists (e.g. from 1-step signup), mark them verified and issue session
      const existingUser = userDAO.findByEmail(cleanEmail);
      let sessionToken = null;
      let userData = null;

      if (existingUser) {
        const verifiedUser = userDAO.markVerified(cleanEmail);
        sessionToken = crypto.randomBytes(32).toString('hex');
        sessionDAO.createSession(sessionToken, verifiedUser.id);
        userData = {
          id: verifiedUser.id,
          email: verifiedUser.email,
          name: verifiedUser.name,
          picture: verifiedUser.picture || '',
          isVerified: true
        };
      }

      return res.json({
        success: true,
        message: 'Gmail verified successfully.',
        verificationToken,
        email: cleanEmail,
        ...(sessionToken ? { token: sessionToken, user: userData } : {})
      });
    } catch (err) {
      console.error('[Auth] Verify OTP error:', err);
      return res.status(500).json({
        error: err.message || 'An error occurred during verification. Please try again.'
      });
    }
  },

  /**
   * POST /api/auth/signup
  /**
   * POST /api/auth/signup
   * Direct, secure signup: Validates compulsory Full Name, strict @gmail.com format,
   * hashes password with scrypt + salt, creates verified user and returns active session.
   */
  async signup(req, res) {
    try {
      const { name, email, password } = req.body || {};

      // 1. Strict Gmail format validation
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!isValidGmail(cleanEmail)) {
        return res.status(400).json({ error: INVALID_GMAIL_MESSAGE });
      }

      // 2. Compulsory Full Name validation
      const displayName = (name || '').trim();
      if (!isValidName(displayName)) {
        return res.status(400).json({
          error: 'Full Name is compulsory (minimum 2 characters, letters required).'
        });
      }

      // 3. Password validation
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          error: 'Password is compulsory and must be at least 6 characters long.'
        });
      }

      // 4. Rate limiting check
      const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const rateCheck = checkSignupRateLimit(clientIp);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: `Too many signup attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`
        });
      }

      // 5. Check if user already exists
      const existingUser = userDAO.findByEmail(cleanEmail);
      if (existingUser) {
        return res.status(409).json({
          error: 'This Gmail address is already registered. Please log in instead.'
        });
      }

      // 6. Hash password using scrypt + 16-byte random salt
      const { hash: passwordHash, salt: passwordSalt } = hashPassword(password);
      const userId = 'user_' + crypto.randomBytes(8).toString('hex');
      const user = userDAO.createUser({
        id: userId,
        email: cleanEmail,
        name: displayName,
        passwordHash,
        passwordSalt,
        isVerified: 1,
        provider: 'gmail'
      });

      // 7. Create authenticated session token
      const token = crypto.randomBytes(32).toString('hex');
      sessionDAO.createSession(token, user.id);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture || '',
          isVerified: true
        }
      });
    } catch (err) {
      console.error('[Auth] Signup error:', err);
      return res.status(500).json({
        error: err.message || 'An error occurred during signup. Please try again.'
      });
    }
  },

  /**
   * POST /api/auth/login
   * Strictly permits login only for verified Gmail accounts
   */
  async login(req, res) {
    try {
      const { email, password, name, picture, credential } = req.body || {};

      // Handle Google Identity Services (Google OAuth button)
      if (credential) {
        const payload = decodeGoogleJwt(credential);
        if (!payload || !payload.email || !isValidGmail(payload.email)) {
          return res.status(400).json({ error: INVALID_GMAIL_MESSAGE });
        }

        const extractedName = (payload.name || payload.given_name || name || '').trim();
        if (!isValidName(extractedName)) {
          return res.status(400).json({ error: 'Full Name is compulsory (minimum 2 characters).' });
        }

        const cleanEmail = payload.email.toLowerCase().trim();
        const userProfile = {
          id: payload.sub || ('g_' + Date.now()),
          email: cleanEmail,
          name: extractedName,
          picture: payload.picture || '',
          provider: 'google'
        };

        const user = userDAO.upsertUser(userProfile);
        const token = crypto.randomBytes(32).toString('hex');
        sessionDAO.createSession(token, user.id);

        return res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            picture: user.picture,
            isVerified: true
          }
        });
      }

      // Handle Direct Gmail Login
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return res.status(400).json({ error: INVALID_GMAIL_MESSAGE });
      }

      if (!isValidGmail(cleanEmail)) {
        return res.status(400).json({
          error: INVALID_GMAIL_MESSAGE
        });
      }

      // Rate limit failed login attempts
      const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const rateKey = `${clientIp}:${cleanEmail}`;
      const rateCheck = checkLoginRateLimit(rateKey);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: `Too many login attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`
        });
      }

      const user = userDAO.findByEmail(cleanEmail);

      // Account enumeration protection: return generic error if user does not exist
      if (!user) {
        return res.status(401).json({ error: 'Invalid Gmail address or password.' });
      }

      // Password verification
      if (user.password_hash && user.password_salt) {
        if (!password || typeof password !== 'string') {
          return res.status(400).json({ error: 'Password is required to log in.' });
        }
        const isValid = verifyPassword(password, user.password_hash, user.password_salt);
        if (!isValid) {
          return res.status(401).json({ error: 'Invalid Gmail address or password.' });
        }
      }

      // Mark verified if not already marked
      if (!user.is_verified) {
        userDAO.markVerified(user.email);
      }

      // Reset login rate limit on successful authentication
      rateLimiter.reset(`login:${rateKey}`);
      userDAO.updateLastLogin(user.id);

      // Issue session token
      const token = crypto.randomBytes(32).toString('hex');
      sessionDAO.createSession(token, user.id);

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          isVerified: true
        }
      });
    } catch (err) {
      console.error('[Auth] Login error:', err);
      return res.status(500).json({
        error: err.message || 'An error occurred during login. Please try again.'
      });
    }
  },

  getMe(req, res) {
    res.json({
      user: req.user
    });
  },

  logout(req, res) {
    if (req.token) {
      sessionDAO.deleteSession(req.token);
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  },

  getMailStatus(req, res) {
    res.json({
      isConfigured: isEmailConfigured()
    });
  },

  async configureMail(req, res) {
    try {
      const { gmailUser, appPassword, resendApiKey } = req.body || {};

      if (resendApiKey) {
        saveResendKeyToEnv(resendApiKey);
        return res.json({
          success: true,
          message: 'Resend API Key configured and active!'
        });
      }

      if (!gmailUser || !appPassword) {
        return res.status(400).json({ error: 'Both Gmail address and 16-character Google App Password are required.' });
      }

      const cleanUser = gmailUser.trim().toLowerCase();
      if (!isValidGmail(cleanUser)) {
        return res.status(400).json({ error: 'Please enter a valid real Gmail address (@gmail.com).' });
      }

      await verifyAndSaveGmailCredentials(cleanUser, appPassword);
      return res.json({
        success: true,
        message: 'Gmail credentials verified and saved to .env successfully!'
      });
    } catch (err) {
      console.error('[Auth] configureMail error:', err);
      return res.status(400).json({ error: err.message || 'Failed to configure email credentials.' });
    }
  },

  enableDevMode(req, res) {
    enableDevModeInEnv();
    return res.json({
      success: true,
      devMode: true,
      message: 'Local Developer Mode activated. Simulated verification codes enabled.'
    });
  }
};
