/**
 * security.js - Cryptographic Utilities & Rate Limiting for Hisabo
 * Implements scrypt password hashing, SHA-256 OTP hashing with salts,
 * timing-safe comparisons, and abuse prevention rate limiting.
 */

import crypto from 'node:crypto';

// ============================================================================
// Password Hashing (scrypt with 16-byte random salt)
// ============================================================================

export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, storedHash, storedSalt) {
  if (!password || !storedHash || !storedSalt) return false;
  try {
    const derivedKey = crypto.scryptSync(password, storedSalt, 64);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (derivedKey.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(derivedKey, storedBuffer);
  } catch (err) {
    return false;
  }
}

// ============================================================================
// OTP Generation & Hashing (SHA-256 with 16-byte random salt)
// ============================================================================

export function generateOtp() {
  // Generates cryptographically secure 6-digit numeric OTP (100000 - 999999)
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
}

export function verifyOtp(inputOtp, storedHash, storedSalt) {
  if (!inputOtp || !storedHash || !storedSalt) return false;
  try {
    const cleanInput = inputOtp.toString().trim();
    const inputHash = hashOtp(cleanInput, storedSalt);
    const inputBuf = Buffer.from(inputHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (inputBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(inputBuf, storedBuf);
  } catch (err) {
    return false;
  }
}

export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================================================
// In-Memory Rate Limiting & Cooldown Engine
// ============================================================================

class RateLimiter {
  constructor() {
    this.store = new Map();
    // Cleanup expired records every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Checks whether an action is allowed under the rate limit.
   * @param {string} key Unique identifier (e.g. IP, email, or composite)
   * @param {number} maxLimit Maximum attempts allowed within the window
   * @param {number} windowMs Duration in milliseconds
   * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }}
   */
  check(key, maxLimit, windowMs) {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || record.resetAt <= now) {
      record = {
        count: 1,
        resetAt: now + windowMs
      };
      this.store.set(key, record);
      return { allowed: true, remaining: maxLimit - 1, retryAfterSeconds: 0 };
    }

    if (record.count >= maxLimit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    record.count += 1;
    return { allowed: true, remaining: maxLimit - record.count, retryAfterSeconds: 0 };
  }

  /**
   * Resets rate limit for a key (e.g. on successful login)
   */
  reset(key) {
    this.store.delete(key);
  }
}

export const rateLimiter = new RateLimiter();

// Preset rate limit checking helpers
export function checkSignupRateLimit(ip) {
  return rateLimiter.check(`signup:${ip}`, 50, 15 * 60 * 1000); // 50 signups per 15 mins per IP
}

export function checkLoginRateLimit(key) {
  return rateLimiter.check(`login:${key}`, 30, 15 * 60 * 1000); // 30 login attempts per 15 mins per key
}

export function checkOtpResendCooldown(email) {
  return rateLimiter.check(`otp_resend:${email}`, 1, 60 * 1000); // 1 resend per 60 seconds
}
