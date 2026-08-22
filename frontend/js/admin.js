/**
 * admin.js — Admin portal: leave queue, history, employees
 * Requires ADMIN role. Redirects otherwise.
 */

requireAdmin();

// ─── Init ─────────────────────────────────────────────────────────────────────

const user = Auth.getUser();
if (user) {
  const el = document.getElementById('userFullName');
  const av = document.getElementById('userAvatarText');
  if (el) el.textContent = user.fullName || 'Admin';
  if (av) av.textContent = (user.fullName || 'A').charAt(0).toUpperCase();
}

document.getElementById('logoutBtn')?.addEventListener('click', logout);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');

    if (btn.dataset.tab === 'pending')   loadPendingLeaves();
    if (btn.dataset.tab === 'history')   loadHistory();
    if (btn.dataset.tab === 'employees') loadEmployees();
  });
});

// ─── Toast ────────────────────────────────────────────────────────────────────

const toast = document.getElementById('toast');
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function leaveTypeLabel(t) {
  return t === 'PAID' ? 'Annual Leave' : t === 'SICK' ? 'Sick Leave' : 'Personal Leave';
}

function leaveTagClass(t) {
  return t === 'SICK' ? 'sick' : t === 'UNPAID' ? 'unpaid' : '';
}

function dayCount(start, end) {
  return Math.floor((new Date(end) - new Date(start)) / 86400000) + 1;
}

function statusBadge(status) {
  const cls = status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'rejected' : 'pending';
  const lbl = status.charAt(0) + status.slice(1).toLowerCase();
  return `<span class="status ${cls}">${lbl}</span>`;
}

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Stats banner ─────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const [pendingRes, empRes, todayAttRes] = await Promise.allSettled([
      api.listAllLeaves({ status: 'PENDING', limit: 1 }),
      api.listEmployees({ limit: 1 }),
      api.listAllAttendance({ date: new Date().toISOString().slice(0, 10), status: 'LEAVE', limit: 1 }),
    ]);

    if (pendingRes.status === 'fulfilled') {
      const n = pendingRes.value.data.pagination?.total ?? 0;
      document.getElementById('statPending').textContent = n;
      const badge = document.getElementById('pendingBadge');
      if (badge) badge.textContent = n > 0 ? n : '';
    }
    if (empRes.status === 'fulfilled') {
      document.getElementById('statEmployees').textContent =
        empRes.value.data.pagination?.total ?? '—';
    }
    if (todayAttRes.status === 'fulfilled') {
      document.getElementById('statOnLeave').textContent =
        todayAttRes.value.data.pagination?.total ?? '—';
    }

    // Approved today
    const today = new Date().toISOString().slice(0, 10);
    const approvedRes = await api.listAllLeaves({ status: 'APPROVED', limit: 100 }).catch(() => null);
    if (approvedRes) {
      const todayApproved = approvedRes.data.items.filter(l =>
        l.decision?.decidedOn && new Date(l.decision.decidedOn).toISOString().slice(0, 10) === today
      ).length;
      document.getElementById('statApproved').textContent = todayApproved;
    }
  } catch (_) {}
}

// ─── Pending queue ────────────────────────────────────────────────────────────

window.loadPendingLeaves = async function () {
  const container = document.getElementById('pendingQueue');
  container.innerHTML = '<p class="state-msg">Loading…</p>';

  const search   = document.getElementById('pendingSearch')?.value.trim().toLowerCase() || '';
  const typeFilter = document.getElementById('pendingTypeFilter')?.value || '';

  try {
    const params = { status: 'PENDING', limit: 50 };
    if (typeFilter) params.leaveType = typeFilter;

    const res   = await api.listAllLeaves(params);
    let items   = res.data.items || [];

    if (search) {
      items = items.filter(l =>
        (l.employeeName || '').toLowerCase().includes(search) ||
        (l.employeeId   || '').toLowerCase().includes(search)
      );
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <div style="font-size:48px;">✅</div>
          <h3 style="margin:16px 0 8px;">All caught up!</h3>
          <p style="color:var(--muted);font-size:13px;">No pending leave requests right now.</p>
        </div>`;
      return;
    }

    container.innerHTML = '';
    items.forEach(leave => container.appendChild(buildLeaveCard(leave, true)));
  } catch (err) {
    container.innerHTML = `<p class="state-msg">Failed to load: ${err.message}</p>`;
  }
};

function buildLeaveCard(leave, showActions) {
  const days    = dayCount(leave.startDate, leave.endDate);
  const card    = document.createElement('div');
  card.className = `leave-card ${leave.status !== 'PENDING' ? 'decided' : ''}`;
  card.id       = `leave-card-${leave._id}`;

  card.innerHTML = `
    <div class="leave-card-left">
      <div class="leave-avatar">${initials(leave.employeeName || leave.employeeId)}</div>
      <div class="leave-card-meta">
        <strong>${leave.employeeName || leave.employeeId}</strong>
        <span>${leave.department ? leave.department + ' · ' : ''}${leave.employeeId}</span>
        <div class="leave-tags">
          <span class="leave-tag ${leaveTagClass(leave.leaveType)}">${leaveTypeLabel(leave.leaveType)}</span>
          <span class="leave-tag days">${days} day${days > 1 ? 's' : ''}</span>
          <span class="leave-tag" style="background:#f0f4ff;color:#3b5bdb;">
            ${fmt(leave.startDate)} → ${fmt(leave.endDate)}
          </span>
        </div>
        ${leave.remarks ? `<div class="leave-remarks">💬 "${leave.remarks}"</div>` : ''}
        ${leave.status !== 'PENDING' ? `
          <div style="margin-top:10px;">
            ${statusBadge(leave.status)}
            ${leave.decision?.comment ? `<div class="decision-comment">Note: "${leave.decision.comment}"</div>` : ''}
          </div>` : ''}
      </div>
    </div>
    <div class="leave-card-actions" id="actions-${leave._id}">
      ${showActions && leave.status === 'PENDING' ? `
        <input class="comment-input" id="comment-${leave._id}" placeholder="Add comment…">
        <button class="btn-approve" onclick="openDecideModal('${leave._id}', 'APPROVED', '${(leave.employeeName || leave.employeeId).replace(/'/g, "\\'")}', '${leave.startDate}', '${leave.endDate}')">✓ Approve</button>
        <button class="btn-reject"  onclick="openDecideModal('${leave._id}', 'REJECTED', '${(leave.employeeName || leave.employeeId).replace(/'/g, "\\'")}', '${leave.startDate}', '${leave.endDate}')">✕ Reject</button>
      ` : statusBadge(leave.status)}
    </div>
  `;
  return card;
}

// ─── Decide modal ─────────────────────────────────────────────────────────────

let _modalLeaveId   = null;
let _modalDecision  = null;

window.openDecideModal = function (leaveId, decision, name, start, end) {
  _modalLeaveId  = leaveId;
  _modalDecision = decision;

  const modal    = document.getElementById('decideModal');
  const title    = document.getElementById('modalTitle');
  const subtitle = document.getElementById('modalSubtitle');
  const confirm  = document.getElementById('modalConfirmBtn');
  const comment  = document.getElementById('modalComment');

  // Pre-fill comment from inline input if present
  const inlineComment = document.getElementById(`comment-${leaveId}`)?.value.trim() || '';
  comment.value = inlineComment;

  if (decision === 'APPROVED') {
    title.textContent     = '✅ Approve Leave Request';
    title.style.color     = 'var(--green)';
    confirm.style.background = 'var(--green)';
    confirm.textContent   = 'Confirm Approval';
  } else {
    title.textContent     = '❌ Reject Leave Request';
    title.style.color     = 'var(--red)';
    confirm.style.background = 'var(--red)';
    confirm.textContent   = 'Confirm Rejection';
  }

  subtitle.textContent = `${name} · ${fmt(start)} → ${fmt(end)}`;
  modal.style.display  = 'flex';
  comment.focus();
};

window.closeModal = function () {
  document.getElementById('decideModal').style.display = 'none';
  _modalLeaveId  = null;
  _modalDecision = null;
};

document.getElementById('modalConfirmBtn')?.addEventListener('click', async () => {
  if (!_modalLeaveId || !_modalDecision) return;

  const comment = document.getElementById('modalComment').value.trim();
  const btn     = document.getElementById('modalConfirmBtn');
  btn.disabled  = true;
  btn.textContent = 'Processing…';

  try {
    await api.decideLeave(_modalLeaveId, _modalDecision, comment);
    closeModal();
    showToast(_modalDecision === 'APPROVED' ? '✅ Leave approved and employee notified.' : '❌ Leave rejected and employee notified.');
    // Refresh all relevant data
    loadPendingLeaves();
    loadStats();
    initAdminBell();
  } catch (err) {
    showToast('Failed: ' + (err.message || 'Unknown error'));
  } finally {
    btn.disabled    = false;
    btn.textContent = _modalDecision === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection';
  }
});

// Close modal on backdrop click
document.getElementById('decideModal')?.addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ─── History table ────────────────────────────────────────────────────────────

window.loadHistory = async function () {
  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = '<tr><td colspan="8" class="state-msg">Loading…</td></tr>';

  const statusFilter = document.getElementById('historyStatusFilter')?.value || '';
  const typeFilter   = document.getElementById('historyTypeFilter')?.value   || '';

  try {
    const params = { limit: 50 };
    if (statusFilter) params.status    = statusFilter;
    if (typeFilter)   params.leaveType = typeFilter;

    const res   = await api.listAllLeaves(params);
    const items = res.data.items || [];

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="state-msg">No records found.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(l => {
      const days = dayCount(l.startDate, l.endDate);
      return `
        <tr>
          <td>
            <span class="emp-avatar-sm">${initials(l.employeeName || l.employeeId)}</span>
            ${l.employeeName || l.employeeId}
          </td>
          <td><span class="leave-tag ${leaveTagClass(l.leaveType)}" style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;">${leaveTypeLabel(l.leaveType)}</span></td>
          <td>${fmt(l.startDate)}</td>
          <td>${fmt(l.endDate)}</td>
          <td>${days}</td>
          <td>${statusBadge(l.status)}</td>
          <td>${l.decision?.decidedBy || '—'}</td>
          <td style="max-width:160px;color:var(--muted);font-size:12px;">${l.decision?.comment || '—'}</td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="state-msg">Error: ${err.message}</td></tr>`;
  }
};

// ─── Employees table ──────────────────────────────────────────────────────────

window.loadEmployees = async function () {
  const tbody = document.getElementById('employeeBody');
  tbody.innerHTML = '<tr><td colspan="5" class="state-msg">Loading…</td></tr>';

  const search = document.getElementById('empSearch')?.value.trim() || '';

  try {
    const params = { limit: 50 };
    if (search) params.search = search;

    const res   = await api.listEmployees(params);
    const items = res.data.items || [];

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="state-msg">No employees found.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(u => `
      <tr>
        <td>
          <span class="emp-avatar-sm">${initials(u.fullName)}</span>
          ${u.fullName}
        </td>
        <td style="color:var(--muted);font-size:12px;">${u.employeeId}</td>
        <td>${u.designation || '—'}</td>
        <td>${u.department  || '—'}</td>
        <td>
          <button onclick="viewBalance('${u.employeeId}')"
            style="background:#f0eeff;color:var(--primary);border:none;padding:5px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;">
            View Balance
          </button>
        </td>
      </tr>`
    ).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="state-msg">Error: ${err.message}</td></tr>`;
  }
};

window.viewBalance = async function (empId) {
  try {
    const res = await api.listAllLeaves({ employeeId: empId, status: 'APPROVED', limit: 1 });
    showToast(`Leave history loaded for ${empId}. Check History tab.`);
    document.getElementById('historyStatusFilter').value = 'APPROVED';
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="history"]').classList.add('active');
    document.getElementById('tab-history').classList.add('active');
    loadHistory();
  } catch (_) {}
};

// ─── Search handlers (live) ───────────────────────────────────────────────────

document.getElementById('pendingSearch')?.addEventListener('input', () => {
  clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(loadPendingLeaves, 400);
});

document.getElementById('empSearch')?.addEventListener('input', () => {
  clearTimeout(window._empTimer);
  window._empTimer = setTimeout(loadEmployees, 400);
});

document.getElementById('pendingTypeFilter')?.addEventListener('change',   loadPendingLeaves);
document.getElementById('historyStatusFilter')?.addEventListener('change', loadHistory);
document.getElementById('historyTypeFilter')?.addEventListener('change',   loadHistory);

// ─── Notification bell ────────────────────────────────────────────────────────

initNotificationBell();
initAdminBell();

// ─── Initial load ─────────────────────────────────────────────────────────────

loadStats();
loadPendingLeaves();


// ─── Tab handler: trigger load on new tabs ────────────────────────────────────
// Patch the existing tab listener to also handle new tabs
const _origTabListener = document.querySelectorAll('.admin-tab');
_origTabListener.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'attendance') loadAdminAttendance();
    if (btn.dataset.tab === 'payroll')    resetAdminPayroll();
  });
});

// ─── ATTENDANCE RECORDS (SRS 3.2.2) ──────────────────────────────────────────

// Set default date to today
const attDateEl = document.getElementById('attDateFilter');
if (attDateEl && !attDateEl.value) attDateEl.value = new Date().toISOString().slice(0, 10);

window.loadAdminAttendance = async function () {
  const tbody = document.getElementById('adminAttBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="state-msg">Loading…</td></tr>';

  const date    = document.getElementById('attDateFilter')?.value || '';
  const empId   = document.getElementById('attEmpFilter')?.value.trim() || '';
  const status  = document.getElementById('attStatusFilter')?.value || '';

  try {
    const params = { limit: 100 };
    if (date)   params.date       = date;
    if (empId)  params.employeeId = empId;
    if (status) params.status     = status;

    const res   = await api.listAllAttendance(params);
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="state-msg">No attendance records found.</td></tr>';
      return;
    }

    const statusCls = { PRESENT: 'approved', HALF_DAY: 'pending', LEAVE: '', ABSENT: 'rejected' };
    const statusCol = { PRESENT: 'var(--green)', HALF_DAY: 'var(--orange)', LEAVE: 'var(--primary)', ABSENT: 'var(--red)' };

    tbody.innerHTML = items.map(r => {
      const checkin  = r.checkIn  ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      const checkout = r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      let worked = '—';
      if (r.checkIn && r.checkOut) {
        const s = Math.floor((new Date(r.checkOut) - new Date(r.checkIn)) / 1000);
        worked = `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
      }
      const sc  = statusCls[r.status] || '';
      const col = statusCol[r.status] || '#6b7280';
      const lbl = r.status ? r.status.replace('_', ' ') : '—';
      return `<tr>
        <td><span class="emp-avatar-sm">${initials(r.employeeId)}</span>${r.employeeId}</td>
        <td>${r.date}</td>
        <td>${checkin}</td>
        <td>${checkout}</td>
        <td>${worked}</td>
        <td><span class="status ${sc}" style="${sc ? '' : `background:#f0eeff;color:${col};`}">${lbl}</span></td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="state-msg">Error: ${err.message}</td></tr>`;
  }
};

// ─── PAYROLL MANAGEMENT (SRS 3.6.2) ──────────────────────────────────────────

let _apTargetEmpId = null;

function resetAdminPayroll() {
  _apTargetEmpId = null;
  document.getElementById('adminPayrollCard')?.setAttribute('style', 'display:none;');
  document.getElementById('adminPayrollEmpty')?.setAttribute('style', 'display:block;text-align:center;padding:48px;color:var(--muted);');
}

function apUpdateNet() {
  const b = Number(document.getElementById('apBasic')?.value)      || 0;
  const h = Number(document.getElementById('apHra')?.value)        || 0;
  const a = Number(document.getElementById('apAllowances')?.value) || 0;
  const d = Number(document.getElementById('apDeductions')?.value) || 0;
  const el = document.getElementById('apComputedNet');
  if (el) el.textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(b + h + a - d);
}
['apBasic','apHra','apAllowances','apDeductions'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', apUpdateNet);
});

window.loadAdminPayroll = async function () {
  const empId = document.getElementById('payrollEmpSearch')?.value.trim();
  if (!empId) { showToast('Enter an Employee ID.'); return; }

  const card  = document.getElementById('adminPayrollCard');
  const empty = document.getElementById('adminPayrollEmpty');

  try {
    const res = await apiFetch(`/payroll/${empId}`);
    _apTargetEmpId = empId;
    const p   = res.data;
    const cur = p.currency || 'INR';
    const gross = (p.basic||0)+(p.hra||0)+(p.allowances||0);

    document.getElementById('adminPayrollEmpLabel').textContent = `Employee: ${empId}`;
    document.getElementById('adminPayrollNetBadge').textContent =
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(p.netSalary || 0) + ' / mo';

    document.getElementById('adminPayrollBody').innerHTML = `
      <tr><td>Basic Salary</td><td>${new Intl.NumberFormat('en-IN',{style:'currency',currency:cur,maximumFractionDigits:0}).format(p.basic||0)}</td></tr>
      <tr><td>HRA</td><td>${new Intl.NumberFormat('en-IN',{style:'currency',currency:cur,maximumFractionDigits:0}).format(p.hra||0)}</td></tr>
      <tr><td>Allowances</td><td>${new Intl.NumberFormat('en-IN',{style:'currency',currency:cur,maximumFractionDigits:0}).format(p.allowances||0)}</td></tr>
      <tr><td>Deductions</td><td style="color:var(--red);">- ${new Intl.NumberFormat('en-IN',{style:'currency',currency:cur,maximumFractionDigits:0}).format(p.deductions||0)}</td></tr>
      <tr style="font-weight:700;"><td>Net Salary</td><td style="color:var(--primary);">${new Intl.NumberFormat('en-IN',{style:'currency',currency:cur,maximumFractionDigits:0}).format(p.netSalary||0)}</td></tr>
    `;

    document.getElementById('apBasic').value      = p.basic      || '';
    document.getElementById('apHra').value        = p.hra        || '';
    document.getElementById('apAllowances').value = p.allowances || '';
    document.getElementById('apDeductions').value = p.deductions || '';
    document.getElementById('apEffectiveFrom').value = p.effectiveFrom
      ? new Date(p.effectiveFrom).toISOString().slice(0,10)
      : new Date().toISOString().slice(0,10);
    apUpdateNet();

    if (card)  card.style.display  = 'block';
    if (empty) empty.style.display = 'none';
  } catch (err) {
    if (err.status === 404) {
      showToast(`No payroll for ${empId} yet — fill in the form to create it.`);
      _apTargetEmpId = empId;
      document.getElementById('adminPayrollEmpLabel').textContent = `New payroll for: ${empId}`;
      document.getElementById('adminPayrollNetBadge').textContent = '';
      document.getElementById('adminPayrollBody').innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:16px;">No existing record</td></tr>';
      document.getElementById('apEffectiveFrom').value = new Date().toISOString().slice(0, 10);
      if (card)  card.style.display  = 'block';
      if (empty) empty.style.display = 'none';
    } else {
      showToast('Error: ' + err.message);
    }
  }
};

document.getElementById('adminSavePayrollBtn')?.addEventListener('click', async () => {
  if (!_apTargetEmpId) { showToast('Load an employee first.'); return; }
  const basic        = Number(document.getElementById('apBasic')?.value)       || 0;
  const hra          = Number(document.getElementById('apHra')?.value)         || 0;
  const allowances   = Number(document.getElementById('apAllowances')?.value)  || 0;
  const deductions   = Number(document.getElementById('apDeductions')?.value)  || 0;
  const effectiveFrom = document.getElementById('apEffectiveFrom')?.value;
  if (basic <= 0)    { showToast('Basic salary must be > 0.'); return; }
  if (!effectiveFrom){ showToast('Set an effective date.'); return; }

  const btn = document.getElementById('adminSavePayrollBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiFetch(`/payroll/${_apTargetEmpId}`, {
      method: 'PUT',
      body: JSON.stringify({ basic, hra, allowances, deductions, effectiveFrom }),
    });
    showToast(`✅ Salary updated for ${_apTargetEmpId}.`);
    loadAdminPayroll(); // reload
  } catch (err) {
    showToast('Failed: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Save Salary Structure';
  }
});
