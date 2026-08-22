/**
 * leave.js — Leave management wired to backend API
 * Applies leave, loads history and balance from server.
 */

requireAuth();

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const startDateInput = document.getElementById('startDate');
const endDateInput   = document.getElementById('endDate');
const totalDays      = document.getElementById('totalDays');
const leaveForm      = document.getElementById('leaveForm');
const leaveHistory   = document.getElementById('leaveHistory');
const logoutBtn      = document.getElementById('logoutBtn');

// Balance cards
const annualBalanceEl   = document.getElementById('annualBalance');
const sickBalanceEl     = document.getElementById('sickBalance');
const personalBalanceEl = document.getElementById('personalBalance');
const totalBalanceEl    = document.getElementById('totalBalance');   // insight number

if (logoutBtn) logoutBtn.addEventListener('click', logout);

// ─── Leave type mapping (frontend label → backend enum) ──────────────────────

const LEAVE_TYPE_MAP = {
  'Annual Leave':   'PAID',
  'Sick Leave':     'SICK',
  'Personal Leave': 'UNPAID',
};

// ─── Date calc ────────────────────────────────────────────────────────────────

function calculateDays() {
  if (!startDateInput.value || !endDateInput.value) {
    totalDays.textContent = 'Select dates';
    return 0;
  }
  const start = new Date(startDateInput.value);
  const end   = new Date(endDateInput.value);
  if (end < start) {
    totalDays.textContent = 'Invalid dates';
    return 0;
  }
  const diff = Math.floor((end - start) / 86400000) + 1;
  totalDays.textContent = diff + ' Day' + (diff > 1 ? 's' : '');
  return diff;
}

startDateInput.addEventListener('change', calculateDays);
endDateInput.addEventListener('change', calculateDays);

// ─── Status badge ─────────────────────────────────────────────────────────────

function statusClass(status) {
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  return 'pending';
}

function statusLabel(status) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

// ─── Render history ───────────────────────────────────────────────────────────

function renderHistory(leaves) {
  if (!leaveHistory) return;
  leaveHistory.innerHTML = '';

  if (!leaves || leaves.length === 0) {
    leaveHistory.innerHTML = `
      <div class="history-row" style="justify-content:center;color:var(--muted);font-size:13px;">
        No leave requests yet.
      </div>`;
    return;
  }

  leaves.forEach(leave => {
    const row = document.createElement('div');
    row.className = 'history-row';

    // Convert backend enum back to readable label
    const typeLabel =
      leave.leaveType === 'PAID'   ? 'Annual Leave'   :
      leave.leaveType === 'SICK'   ? 'Sick Leave'      :
      leave.leaveType === 'UNPAID' ? 'Personal Leave'  : leave.leaveType;

    const days = Math.floor((new Date(leave.endDate) - new Date(leave.startDate)) / 86400000) + 1;

    row.innerHTML = `
      <div>
        <strong>${typeLabel}</strong>
        <p style="font-size:11px;color:var(--muted);margin-top:4px;">
          ${leave.startDate} – ${leave.endDate}
        </p>
        ${leave.decision?.comment ? `<p style="font-size:11px;color:var(--muted);margin-top:3px;font-style:italic;">Admin note: "${leave.decision.comment}"</p>` : ''}
      </div>
      <strong>${days} Day${days > 1 ? 's' : ''}</strong>
      <span class="status ${statusClass(leave.status)}">${statusLabel(leave.status)}</span>
    `;

    // Allow cancelling pending leaves
    if (leave.status === 'PENDING') {
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '✕';
      cancelBtn.title = 'Cancel request';
      cancelBtn.style.cssText =
        'background:none;border:1px solid #ef4444;color:#ef4444;' +
        'border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px;';
      cancelBtn.addEventListener('click', async () => {
        if (!confirm('Cancel this leave request?')) return;
        try {
          await api.cancelLeave(leave._id);
          showToast('Leave request cancelled.');
          loadLeaveData();
        } catch (err) {
          showToast('Could not cancel: ' + (err.message || 'Unknown error'));
        }
      });
      row.appendChild(cancelBtn);
    }

    leaveHistory.appendChild(row);
  });
}

// ─── Load balance + history ───────────────────────────────────────────────────

async function loadLeaveData() {
  try {
    const [balanceRes, historyRes] = await Promise.allSettled([
      api.getMyLeaveBalance(),
      api.getMyLeaves({ limit: 20 }),
    ]);

    if (balanceRes.status === 'fulfilled') {
      const b = balanceRes.value.data;
      if (annualBalanceEl)   annualBalanceEl.textContent   = `${b.paid ?? 0} Days`;
      if (sickBalanceEl)     sickBalanceEl.textContent     = `${b.sick ?? 0} Days`;
      if (personalBalanceEl) personalBalanceEl.textContent = 'Unlimited';
      const total = (b.paid ?? 0) + (b.sick ?? 0);
      if (totalBalanceEl) totalBalanceEl.textContent = total;
    }

    if (historyRes.status === 'fulfilled') {
      renderHistory(historyRes.value.data.items);
    }
  } catch (err) {
    console.error('Failed to load leave data:', err);
  }
}

// ─── Submit leave ─────────────────────────────────────────────────────────────

const submitBtn = leaveForm ? leaveForm.querySelector('button[type="submit"]') : null;

let toastEl = document.getElementById('toast');
if (!toastEl) {
  toastEl = document.createElement('div');
  toastEl.id = 'toast';
  toastEl.style.cssText =
    'position:fixed;bottom:25px;right:25px;background:#17172b;color:white;' +
    'padding:15px 22px;border-radius:12px;transform:translateY(100px);opacity:0;' +
    'transition:.3s;z-index:9999;';
  document.body.appendChild(toastEl);
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.style.transform = 'translateY(0)';
  toastEl.style.opacity = '1';
  setTimeout(() => {
    toastEl.style.transform = 'translateY(100px)';
    toastEl.style.opacity = '0';
  }, 3000);
}

if (leaveForm) {
  leaveForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const typeLabel = document.getElementById('leaveType').value;
    const leaveType = LEAVE_TYPE_MAP[typeLabel];
    const start     = startDateInput.value;
    const end       = endDateInput.value;
    const remarks   = document.getElementById('reason')?.value?.trim() || '';

    if (!leaveType) { showToast('Please select a leave type.'); return; }
    if (totalDays.textContent === 'Invalid dates' || totalDays.textContent === 'Select dates') {
      showToast('Please select valid dates.');
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    try {
      await api.applyLeave({ leaveType, startDate: start, endDate: end, remarks });
      showToast('✓ Leave request submitted!');
      leaveForm.reset();
      totalDays.textContent = 'Select dates';
      loadLeaveData();
    } catch (err) {
      const msg =
        err.code === 'INSUFFICIENT_BALANCE' ? err.message :
        err.code === 'LEAVE_OVERLAP'        ? 'You already have a leave request for these dates.' :
        err.code === 'INVALID_DATE_RANGE'   ? 'End date cannot be before start date.' :
        'Failed to submit: ' + (err.message || 'Unknown error');
      showToast(msg);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Leave Request →'; }
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadLeaveData();
initNotificationBell();
