/**
 * api.js — Central API client for Dayflow HRMS
 */

const API_BASE = 'http://localhost:5000/v1';

// ─── Token helpers ────────────────────────────────────────────────────────────

const Auth = {
  getAccessToken()  { return localStorage.getItem('dayflow_access'); },
  getRefreshToken() { return localStorage.getItem('dayflow_refresh'); },
  getUser() {
    try { return JSON.parse(localStorage.getItem('dayflow_user')); }
    catch { return null; }
  },
  setSession(data) {
    localStorage.setItem('dayflow_access',  data.accessToken);
    localStorage.setItem('dayflow_refresh', data.refreshToken);
    localStorage.setItem('dayflow_user',    JSON.stringify(data.user));
  },
  setAccessToken(token) { localStorage.setItem('dayflow_access', token); },
  clear() {
    ['dayflow_access','dayflow_refresh','dayflow_user',
     'dayflowCheckedIn','dayflowAttendanceStatus',
     'dayflowStartTime','dayflowTotalBreak',
     'dayflowCheckInTime','dayflowBreakStart'].forEach(k => localStorage.removeItem(k));
  },
  isLoggedIn() { return !!this.getAccessToken() && !!this.getUser(); },
  isAdmin()    { return this.getUser()?.role === 'ADMIN'; },
};

// ─── Token refresh ────────────────────────────────────────────────────────────

let _refreshPromise = null;

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
    if (!res.ok) { Auth.clear(); window.location.href = 'login.html'; throw new Error('Session expired'); }
    const body = await res.json();
    Auth.setAccessToken(body.data.accessToken);
    return body.data.accessToken;
  })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch(path, options = {}, _retry = true) {
  const token = Auth.getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 204) return null;

  if (res.status === 401 && _retry) {
    try { await refreshAccessToken(); return apiFetch(path, options, false); }
    catch { redirectToLogin(); return; }
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.code = body.code || 'API_ERROR';
    err.status = res.status;
    err.details = body;
    throw err;
  }
  return body;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

function requireAuth() {
  if (!Auth.isLoggedIn()) redirectToLogin();
}

function requireAdmin() {
  if (!Auth.isLoggedIn()) { redirectToLogin(); return; }
  if (!Auth.isAdmin()) { window.location.href = 'index.html'; }
}

function redirectToLogin() {
  if (!window.location.pathname.endsWith('login.html')) window.location.href = 'login.html';
}

async function logout() {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (_) {}
  Auth.clear();
  window.location.href = 'login.html';
}

// ─── API surface ──────────────────────────────────────────────────────────────

const api = {
  // Auth
  login: (email, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  // Profile
  getMyProfile:    ()     => apiFetch('/employees/me'),
  updateMyProfile: (data) => apiFetch('/employees/me', { method: 'PATCH', body: JSON.stringify(data) }),

  // Admin — employees
  listEmployees: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/employees${qs ? '?' + qs : ''}`);
  },
  getPendingRegistrations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/employees/pending${qs ? '?' + qs : ''}`);
  },
  approveEmployee: (employeeId, note = '', jobDetails = null) =>
    apiFetch(`/employees/${employeeId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ note, ...(jobDetails ? { jobDetails } : {}) }),
    }),
  rejectEmployee: (employeeId, note = '') =>
    apiFetch(`/employees/${employeeId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),

  // Attendance
  checkIn:  (location = '') => apiFetch('/attendance/check-in',  { method: 'POST', body: JSON.stringify({ location }) }),
  checkOut: ()               => apiFetch('/attendance/check-out', { method: 'POST', body: JSON.stringify({}) }),
  getMyAttendance: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/attendance/me${qs ? '?' + qs : ''}`);
  },
  listAllAttendance: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/attendance${qs ? '?' + qs : ''}`);
  },

  // Leave — employee
  applyLeave:        (data)    => apiFetch('/leaves',    { method: 'POST', body: JSON.stringify(data) }),
  getMyLeaves:       (params = {}) => { const qs = new URLSearchParams(params).toString(); return apiFetch(`/leaves/me${qs ? '?' + qs : ''}`); },
  getMyLeaveBalance: ()        => apiFetch('/leaves/me/balance'),
  cancelLeave:       (leaveId) => apiFetch(`/leaves/${leaveId}`, { method: 'DELETE' }),

  // Leave — admin
  listAllLeaves: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/leaves${qs ? '?' + qs : ''}`);
  },
  decideLeave: (leaveId, decision, comment = '') =>
    apiFetch(`/leaves/${leaveId}/decision`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, comment }),
    }),

  // Payroll
  getMyPayroll: () => apiFetch('/payroll/me'),

  // Notifications — employee
  getMyNotifications: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/notifications/me${qs ? '?' + qs : ''}`);
  },
  markAllRead:         ()             => apiFetch('/notifications/me/read-all', { method: 'PATCH', body: JSON.stringify({}) }),
  markNotificationRead: (id)          => apiFetch(`/notifications/${id}/read`,  { method: 'PATCH', body: JSON.stringify({}) }),

  // Notifications — admin
  getPendingLeaveCount: () => apiFetch('/notifications/admin/pending-count'),
};

// ─── Notification bell (shared across all pages) ─────────────────────────────

let _bellInterval = null;

function initNotificationBell() {
  const bell     = document.getElementById('notifBell');
  const badge    = document.getElementById('notifBadge');
  const dropdown = document.getElementById('notifDropdown');

  if (!bell) return;

  async function fetchAndRender() {
    try {
      const res = await api.getMyNotifications({ limit: 8 });
      const items   = res.data || [];
      const unread  = res.unreadCount || 0;

      // Badge
      if (badge) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
      }

      // Dropdown list
      if (dropdown) {
        const list = dropdown.querySelector('.notif-list');
        if (!list) return;
        if (items.length === 0) {
          list.innerHTML = '<p class="notif-empty">You are all caught up.</p>';
          return;
        }
        list.innerHTML = items.map(n => `
          <div class="notif-item ${n.isRead ? '' : 'unread'}" data-id="${n._id}">
            <div class="notif-dot ${n.isRead ? 'read' : ''}"></div>
            <div>
              <strong>${n.title}</strong>
              <p>${n.body}</p>
              <span>${timeAgo(n.createdAt)}</span>
            </div>
          </div>
        `).join('');

        // Click to mark read
        list.querySelectorAll('.notif-item').forEach(el => {
          el.addEventListener('click', async () => {
            const id = el.dataset.id;
            if (!el.classList.contains('unread')) return;
            await api.markNotificationRead(id).catch(() => {});
            el.classList.remove('unread');
            el.querySelector('.notif-dot').classList.add('read');
            const cur = parseInt(badge?.textContent) || 0;
            if (badge && cur > 0) {
              const next = cur - 1;
              badge.textContent = next > 9 ? '9+' : next;
              badge.style.display = next > 0 ? 'flex' : 'none';
            }
          });
        });
      }
    } catch (_) {}
  }

  // Toggle dropdown
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!dropdown) return;
    const open = dropdown.style.display === 'block';
    dropdown.style.display = open ? 'none' : 'block';
    if (!open) fetchAndRender();
  });

  document.addEventListener('click', () => {
    if (dropdown) dropdown.style.display = 'none';
  });

  // Mark all read button
  const markAllBtn = document.getElementById('markAllReadBtn');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await api.markAllRead().catch(() => {});
      if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
      const list = dropdown?.querySelector('.notif-list');
      if (list) list.querySelectorAll('.notif-item').forEach(el => {
        el.classList.remove('unread');
        el.querySelector('.notif-dot')?.classList.add('read');
      });
    });
  }

  // Poll every 30s
  fetchAndRender();
  _bellInterval = setInterval(fetchAndRender, 30000);
}

// Admin bell — shows pending leave count
function initAdminBell() {
  const badge = document.getElementById('notifBadge');
  async function poll() {
    try {
      const res = await api.getPendingLeaveCount();
      const count = res.data?.unreadRequests || 0;
      if (badge) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      }
    } catch (_) {}
  }
  poll();
  setInterval(poll, 30000);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Expose everything
window.Auth             = Auth;
window.api              = api;
window.logout           = logout;
window.requireAuth      = requireAuth;
window.requireAdmin     = requireAdmin;
window.initNotificationBell = initNotificationBell;
window.initAdminBell    = initAdminBell;
