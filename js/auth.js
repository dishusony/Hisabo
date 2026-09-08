/**
 * auth.js - Authentication Service for Hisabo
 * Handles Google Identity Services (GIS), JWT decoding, session persistence,
 * and direct Gmail sign-in with full theme integration.
 */

import { api } from './api.js';

const STORAGE_KEYS = {
  USER: 'hisabo_auth_user_v1',
  CLIENT_ID: 'hisabo_google_client_id_v1'
};

class AuthService {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    this.googleClientId = '';
    this.isGsiLoaded = false;
    this.loadPersistedUser();
  }

  loadPersistedUser() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEYS.USER);
        if (saved) {
          this.currentUser = JSON.parse(saved);
        }
        const savedClientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
        if (savedClientId) {
          this.googleClientId = savedClientId;
        }
      }
    } catch (e) {
      console.error('[Auth] Failed to load persisted user:', e);
      this.currentUser = null;
    }
  }

  /**
   * Initialize authentication service.
   * Attempts to fetch server-configured Google Client ID if not already saved.
   */
  async init() {
    if (!this.googleClientId && typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/auth/config');
        if (res.ok) {
          const data = await res.json();
          if (data.googleClientId) {
            this.googleClientId = data.googleClientId;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(STORAGE_KEYS.CLIENT_ID, this.googleClientId);
            }
          }
        }
      } catch (err) {
        // Local or static deployment without backend
      }
    }

    this.checkGsiLoaded();
    this.notify();
  }

  /**
   * Check if Google Identity Services script is loaded and initialize if Client ID is present
   */
  checkGsiLoaded() {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      this.isGsiLoaded = true;
      if (this.googleClientId) {
        this.initializeGoogleIdentity(this.googleClientId);
      }
      return true;
    }
    return false;
  }

  /**
   * Set and persist custom Google Client ID
   */
  setGoogleClientId(clientId) {
    this.googleClientId = (clientId || '').trim();
    if (typeof localStorage !== 'undefined') {
      if (this.googleClientId) {
        localStorage.setItem(STORAGE_KEYS.CLIENT_ID, this.googleClientId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
      }
    }
    if (this.googleClientId && typeof window !== 'undefined' && window.google?.accounts?.id) {
      this.initializeGoogleIdentity(this.googleClientId);
    }
  }

  getGoogleClientId() {
    return this.googleClientId;
  }

  /**
   * Initialize Google Identity Services with Client ID
   */
  initializeGoogleIdentity(clientId) {
    if (typeof window === 'undefined' || !window.google?.accounts?.id) return;
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => this.handleGoogleCredentialResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true
      });
      this.isGsiLoaded = true;
    } catch (err) {
      console.warn('[Auth] Error initializing Google Accounts:', err);
    }
  }

  /**
   * Render official Google Sign-In button into a DOM container
   */
  renderGoogleButton(containerElement) {
    if (!containerElement || typeof window === 'undefined' || !window.google?.accounts?.id) {
      return false;
    }
    if (!this.googleClientId) {
      return false;
    }
    try {
      window.google.accounts.id.renderButton(containerElement, {
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 280
      });
      return true;
    } catch (err) {
      console.warn('[Auth] Failed to render Google button:', err);
      return false;
    }
  }

  /**
   * Decode JWT credential token from Google without third-party dependencies
   */
  decodeJwtResponse(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('[Auth] Failed to decode Google JWT token:', e);
      return null;
    }
  }

  /**
   * Handle credential response from Google Identity Services
   */
  handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      console.error('[Auth] Invalid Google credential response');
      return null;
    }

    const payload = this.decodeJwtResponse(response.credential);
    if (!payload || !payload.email) {
      console.error('[Auth] Could not extract user profile from Google token');
      return null;
    }

    const user = {
      id: payload.sub || 'g_' + Date.now(),
      email: payload.email,
      name: payload.name || payload.given_name || payload.email.split('@')[0],
      picture: payload.picture || this.generateAvatarUrl(payload.name || payload.email),
      givenName: payload.given_name || payload.name,
      provider: 'google',
      isVerified: Boolean(payload.email_verified),
      signedInAt: new Date().toISOString()
    };

    this.setCurrentUser(user);
    if (typeof fetch !== 'undefined') {
      api.login({ credential: response.credential }).catch(e => {
        console.warn('[Auth] Backend sync note:', e.message);
      });
    }
    return user;
  }

  /**
   * Direct Gmail Login (Instant 1-Tap or manual email entry)
   * Perfect for local testing, offline mode, or when OAuth credentials are not yet configured.
   */
  loginWithGmail(email, name = '', picture = '') {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !this.validateEmail(cleanEmail)) {
      throw new Error('Please enter a valid Gmail or email address');
    }

    const displayName = (name || '').trim() || this.extractNameFromEmail(cleanEmail);
    const avatar = picture || this.generateAvatarUrl(displayName);

    const user = {
      id: 'gmail_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
      email: cleanEmail,
      name: displayName,
      picture: avatar,
      givenName: displayName.split(' ')[0],
      provider: 'google',
      isVerified: true,
      signedInAt: new Date().toISOString()
    };

    this.setCurrentUser(user);
    if (typeof fetch !== 'undefined') {
      api.login({ email: cleanEmail, name: displayName, picture: avatar }).catch(e => {
        console.warn('[Auth] Backend sync note:', e.message);
      });
    }
    return user;
  }

  /**
   * Validate email format
   */
  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Extract user-friendly display name from email address
   */
  extractNameFromEmail(email) {
    const localPart = email.split('@')[0];
    return localPart
      .replace(/[._-]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'Google User';
  }

  /**
   * Generate an aesthetically pleasing SVG / Canvas avatar data URL or SVG badge
   */
  generateAvatarUrl(name) {
    const initials = (name || 'U')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');

    // Return a lightweight SVG data URL
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="50%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="40" fill="url(#g)" />
      <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  /**
   * Set user and persist to storage
   */
  setCurrentUser(user) {
    this.currentUser = user;
    try {
      if (typeof localStorage !== 'undefined') {
        if (user) {
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        } else {
          localStorage.removeItem(STORAGE_KEYS.USER);
        }
      }
    } catch (e) {
      console.error('[Auth] Failed to persist user:', e);
    }

    this.notify();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return Boolean(this.currentUser && this.currentUser.email);
  }

  /**
   * Sign out current user
   */
  logout() {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.disableAutoSelect();
      } catch (e) {
        // Ignore GIS shutdown errors
      }
    }
    if (typeof fetch !== 'undefined') {
      api.logout().catch(() => {});
    }
    this.setCurrentUser(null);
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
      // Immediately trigger for initial state
      callback(this.currentUser);
    }
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach((callback) => {
      try {
        callback(this.currentUser);
      } catch (err) {
        console.error('[Auth] Listener error:', err);
      }
    });

    // Also dispatch custom DOM event
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hisabo:auth-changed', {
          detail: { user: this.currentUser }
        })
      );
    }
  }
}

export const authService = new AuthService();
export { AuthService };
