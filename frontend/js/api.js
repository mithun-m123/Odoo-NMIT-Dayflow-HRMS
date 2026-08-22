/**
 * api.js — Central API client for Dayflow HRMS
 *
 * Handles:
 *  - Base URL configuration
 *  - Attaching Bearer tokens to every request
 *  - Automatic access-token refresh on 401
 *  - Auth guard (redirect to login if not authenticated)
 *  - Token storage in localStorage
 */

const API_BASE = 'http://localhost:5000/v1';

// ─── Token helpers ───────────────────────────────────────────────────────────

const Auth = {
  getAccessToken()  { return localStorage.getItem('dayflow_access'); },
  getRefreshToken() { return localStorage.getItem('dayflow_refresh'); },
  getUser()         {
    try { return JSON.parse(localStorage.getItem('dayflow_user')); }
    catch { return null; }
  },

  setSession(data) {
    localStorage.setItem('dayflow_access',  data.accessToken);
    localStorage.setItem('dayflow_refresh', data.refreshToken);
    localStorage.setItem('dayflow_user',    JSON.stringify(data.user));
  },

  setAccessToken(token) {
    localStorage.setItem('dayflow_access', token);
  },

  clear() {
    ['dayflow_access', 'dayflow_refresh', 'dayflow_user',
     'dayflowCheckedIn', 'dayflowAttendanceStatus',
     'dayflowStartTime', 'dayflowTotalBreak',
     'dayflowCheckInTime', 'dayflowBreakStart'].forEach(k => localStorage.removeItem(k));
  },

  isLoggedIn() {
    return !!this.getAccessToken() && !!this.getUser();
  },
};

// ─── Token refresh ────────────────────────────────────────────────────────────

let _refreshPromise = null; // deduplicate concurrent refresh calls

async function refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = Auth.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      Auth.clear();
      window.location.href = '/login.html';
      throw new Error('Session expired');
    }

    const body = await res.json();
    Auth.setAccessToken(body.data.accessToken);
    return body.data.accessToken;
  })().finally(() => { _refreshPromise = null; });

  return _refreshPromise;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/**
 * apiFetch(path, options)
 *
 * Wraps fetch with:
 *  - Auth header injection
 *  - Automatic 401 → refresh → retry (once)
 *  - Structured error throwing: { code, message }
 */
async function apiFetch(path, options = {}, _retry = true) {
  const token = Auth.getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // 204 No Content
  if (res.status === 204) return null;

  // Attempt to refresh on 401 (once)
  if (res.status === 401 && _retry) {
    try {
      await refreshAccessToken();
      return apiFetch(path, options, false);
    } catch {
      redirectToLogin();
      return;
    }
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.code    = body.code    || 'API_ERROR';
    err.status  = res.status;
    err.details = body;
    throw err;
  }

  return body;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

function requireAuth() {
  if (!Auth.isLoggedIn()) {
    redirectToLogin();
  }
}

function redirectToLogin() {
  // Avoid redirect loop if already on login page
  if (!window.location.pathname.endsWith('login.html')) {
    window.location.href = 'login.html';
  }
}

async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (_) { /* best-effort */ }
  Auth.clear();
  window.location.href = 'login.html';
}

// ─── API surface ──────────────────────────────────────────────────────────────

const api = {
  // Auth
  login(email, password) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Profile
  getMyProfile() {
    return apiFetch('/employees/me');
  },
  updateMyProfile(data) {
    return apiFetch('/employees/me', { method: 'PATCH', body: JSON.stringify(data) });
  },

  // Attendance
  checkIn(location = '') {
    return apiFetch('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ location }),
    });
  },
  checkOut() {
    return apiFetch('/attendance/check-out', { method: 'POST', body: JSON.stringify({}) });
  },
  getMyAttendance(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/attendance/me${qs ? '?' + qs : ''}`);
  },

  // Leave
  applyLeave(data) {
    return apiFetch('/leaves', { method: 'POST', body: JSON.stringify(data) });
  },
  getMyLeaves(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/leaves/me${qs ? '?' + qs : ''}`);
  },
  getMyLeaveBalance() {
    return apiFetch('/leaves/me/balance');
  },
  cancelLeave(leaveId) {
    return apiFetch(`/leaves/${leaveId}`, { method: 'DELETE' });
  },

  // Payroll
  getMyPayroll() {
    return apiFetch('/payroll/me');
  },

  // Notifications
  getMyNotifications() {
    return apiFetch('/notifications/me');
  },
  markAllRead() {
    return apiFetch('/notifications/me/read-all', { method: 'PATCH', body: JSON.stringify({}) });
  },
};

// Expose to all pages
window.Auth    = Auth;
window.api     = api;
window.logout  = logout;
window.requireAuth = requireAuth;
