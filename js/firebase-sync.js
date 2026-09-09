/**
 * firebase-sync.js - Real-Time Multi-Browser Cloud Synchronization for Hisabo
 * 
 * Uses Google Firebase Firestore (100% Free on Spark Plan) to synchronize
 * expenses and monthly budgets live across multiple browsers, laptops, and phones.
 */

const STORAGE_KEYS = {
  FIREBASE_CONFIG: 'hisabo_firebase_config_v1',
  SYNC_STATUS: 'hisabo_sync_status_v1'
};

class FirebaseSyncService {
  constructor() {
    this.app = null;
    this.db = null;
    this.config = null;
    this.isInitialized = false;
    this.activeUserEmail = null;
    this.expenseUnsubscribe = null;
    this.budgetUnsubscribe = null;
    this.statusListeners = [];
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.lastError = null;

    this.loadSavedConfig();
  }

  loadSavedConfig() {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
      if (saved) {
        this.config = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[CloudSync] Could not parse saved Firebase config:', e);
    }
  }

  saveConfig(config) {
    this.config = config;
    if (typeof localStorage !== 'undefined') {
      if (config) {
        localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
      } else {
        localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
      }
    }
  }

  isConfigured() {
    return Boolean(
      this.config &&
      this.config.projectId &&
      this.config.apiKey
    );
  }

  getStatus() {
    return {
      status: this.status,
      isConfigured: this.isConfigured(),
      projectId: this.config?.projectId || null,
      activeUserEmail: this.activeUserEmail,
      lastError: this.lastError
    };
  }

  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.statusListeners.push(callback);
      callback(this.getStatus());
    }
  }

  notifyStatus(status, error = null) {
    this.status = status;
    this.lastError = error ? (error.message || String(error)) : null;
    const current = this.getStatus();
    this.statusListeners.forEach((fn) => {
      try { fn(current); } catch (e) {}
    });
  }

  /**
   * Initializes Firebase App and Firestore SDK from Google CDN
   */
  async init(customConfig = null) {
    if (customConfig) {
      this.saveConfig(customConfig);
    }

    if (!this.isConfigured()) {
      this.notifyStatus('disconnected');
      return false;
    }

    // Only run in browser environment
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      this.notifyStatus('connecting');

      // Dynamically import official Google Firebase SDKs via CDN
      const { initializeApp, getApps } = await import(
        'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
      );
      const {
        getFirestore,
        collection,
        doc,
        setDoc,
        deleteDoc,
        getDoc,
        getDocs,
        onSnapshot
      } = await import(
        'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
      );

      this.firestoreMethods = {
        collection,
        doc,
        setDoc,
        deleteDoc,
        getDoc,
        getDocs,
        onSnapshot
      };

      const existingApps = getApps();
      if (existingApps.length > 0) {
        this.app = existingApps[0];
      } else {
        this.app = initializeApp(this.config);
      }

      this.db = getFirestore(this.app);
      this.isInitialized = true;
      this.notifyStatus('connected');
      console.log('[CloudSync] Connected to Firebase Firestore project:', this.config.projectId);
      return true;
    } catch (err) {
      console.error('[CloudSync] Firebase initialization failed:', err);
      this.notifyStatus('error', err);
      return false;
    }
  }

  /**
   * Helper to normalize user email as Firestore safe document ID
   */
  sanitizeEmail(email) {
    if (!email) return '';
    return email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  }

  /**
   * Subscribe to real-time expense updates for a specific Gmail account.
   * When any other browser adds/edits/deletes an expense, onExpensesChanged is invoked.
   */
  async subscribeExpenses(email, onExpensesChanged) {
    const cleanEmail = this.sanitizeEmail(email);
    if (!cleanEmail) return () => {};

    if (!this.isInitialized) {
      const ready = await this.init();
      if (!ready) return () => {};
    }

    if (this.expenseUnsubscribe) {
      this.expenseUnsubscribe();
      this.expenseUnsubscribe = null;
    }

    this.activeUserEmail = cleanEmail;

    try {
      const { collection, onSnapshot } = this.firestoreMethods;
      const expensesRef = collection(this.db, 'users', cleanEmail, 'expenses');

      this.expenseUnsubscribe = onSnapshot(
        expensesRef,
        (snapshot) => {
          const cloudExpenses = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            cloudExpenses.push({
              ...data,
              id: docSnap.id
            });
          });

          // Sort by date descending
          cloudExpenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

          this.notifyStatus('connected');
          if (typeof onExpensesChanged === 'function') {
            onExpensesChanged(cloudExpenses);
          }
        },
        (error) => {
          console.warn('[CloudSync] Expenses listener error:', error);
          this.notifyStatus('error', error);
        }
      );

      return this.expenseUnsubscribe;
    } catch (err) {
      console.warn('[CloudSync] Failed to attach expenses listener:', err);
      return () => {};
    }
  }

  /**
   * Subscribe to real-time budget updates for a specific Gmail account.
   */
  async subscribeBudgets(email, onBudgetsChanged) {
    const cleanEmail = this.sanitizeEmail(email);
    if (!cleanEmail) return () => {};

    if (!this.isInitialized) {
      const ready = await this.init();
      if (!ready) return () => {};
    }

    if (this.budgetUnsubscribe) {
      this.budgetUnsubscribe();
      this.budgetUnsubscribe = null;
    }

    try {
      const { doc, onSnapshot } = this.firestoreMethods;
      const budgetDocRef = doc(this.db, 'users', cleanEmail, 'settings', 'budgets');

      this.budgetUnsubscribe = onSnapshot(
        budgetDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const budgets = docSnap.data() || {};
            if (typeof onBudgetsChanged === 'function') {
              onBudgetsChanged(budgets);
            }
          }
        },
        (error) => {
          console.warn('[CloudSync] Budgets listener error:', error);
        }
      );

      return this.budgetUnsubscribe;
    } catch (err) {
      console.warn('[CloudSync] Failed to attach budgets listener:', err);
      return () => {};
    }
  }

  /**
   * Save an individual expense to Firestore in real time
   */
  async saveExpense(email, expense) {
    const cleanEmail = this.sanitizeEmail(email);
    if (!cleanEmail || !expense || !expense.id) return false;

    if (!this.isInitialized) {
      const ok = await this.init();
      if (!ok) return false;
    }

    try {
      const { doc, setDoc } = this.firestoreMethods;
      const docRef = doc(this.db, 'users', cleanEmail, 'expenses', expense.id);
      
      const payload = {
        id: expense.id,
        date: expense.date || '',
        monthKey: expense.monthKey || '',
        item: expense.item || '',
        amount: Number(expense.amount) || 0,
        category: expense.category || 'Other',
        paymentMethod: expense.paymentMethod || 'Cash',
        notes: expense.notes || '',
        userEmail: cleanEmail,
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.error('[CloudSync] Error saving expense to Firestore:', err);
      return false;
    }
  }

  /**
   * Delete an expense from Firestore in real time
   */
  async deleteExpense(email, expenseId) {
    const cleanEmail = this.sanitizeEmail(email);
    if (!cleanEmail || !expenseId) return false;

    if (!this.isInitialized) {
      const ok = await this.init();
      if (!ok) return false;
    }

    try {
      const { doc, deleteDoc } = this.firestoreMethods;
      const docRef = doc(this.db, 'users', cleanEmail, 'expenses', expenseId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.error('[CloudSync] Error deleting expense from Firestore:', err);
      return false;
    }
  }

  /**
   * Save monthly budgets map to Firestore
   */
  async saveBudgets(email, budgets) {
    const cleanEmail = this.sanitizeEmail(email);
    if (!cleanEmail || !budgets) return false;

    if (!this.isInitialized) {
      const ok = await this.init();
      if (!ok) return false;
    }

    try {
      const { doc, setDoc } = this.firestoreMethods;
      const docRef = doc(this.db, 'users', cleanEmail, 'settings', 'budgets');
      await setDoc(docRef, budgets, { merge: true });
      return true;
    } catch (err) {
      console.error('[CloudSync] Error saving budgets to Firestore:', err);
      return false;
    }
  }

  /**
   * One-click upload: uploads all local expenses and budgets to the cloud
   */
  async syncLocalToCloud(email, localExpenses = [], localBudgets = {}) {
    const cleanEmail = this.sanitizeEmail(email);
    if (!cleanEmail) return { success: false, error: 'No valid email' };

    if (!this.isInitialized) {
      const ok = await this.init();
      if (!ok) return { success: false, error: 'Firebase not connected' };
    }

    try {
      let uploaded = 0;
      for (const exp of localExpenses) {
        if (exp && exp.id) {
          await this.saveExpense(cleanEmail, exp);
          uploaded++;
        }
      }

      if (localBudgets && Object.keys(localBudgets).length > 0) {
        await this.saveBudgets(cleanEmail, localBudgets);
      }

      return { success: true, count: uploaded };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Disconnect and clear listeners (e.g. on logout)
   */
  disconnect() {
    if (this.expenseUnsubscribe) {
      try { this.expenseUnsubscribe(); } catch (e) {}
      this.expenseUnsubscribe = null;
    }
    if (this.budgetUnsubscribe) {
      try { this.budgetUnsubscribe(); } catch (e) {}
      this.budgetUnsubscribe = null;
    }
    this.activeUserEmail = null;
    this.notifyStatus(this.isConfigured() ? 'disconnected' : 'unconfigured');
  }
}

export const cloudSync = new FirebaseSyncService();
