/**
 * app.js — Dashboard: real data from API, dynamic activity feed,
 * admin quick-stats panel, time-based greeting.
 */

requireAuth();

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const greetingName    = document.getElementById('greetingName');
const timeGreet       = document.getElementById('timeGreet');
const todayDateEl     = document.getElementById('todayDate');
const userAvatarText  = document.getElementById('userAvatarText');
const userFullName    = document.getElementById('userFullName');
const userDesignation = document.getElementById('userDesignation');
const attendanceEl    = document.getElementById('attendanceStatus');
const leaveBalanceEl  = document.getElementById('leaveBalance');
const netSalaryEl     = document.getElementById('netSalary');
const heroScore       = document.getElementById('heroScore');
const heroTitle       = document.getElementById('heroTitle');
const activityFeed    = document.getElementById('activityFeed');
const insightText     = document.getElementById('insightText');
const insightAction   = document.getElementById('insightAction');
const adminPanel      = document.getElementById('adminPanel');
const adminQuickStats = document.getElementById('adminQuickStats');
const logoutBtn       = document.getElementById('logoutBtn');

// ─── Logout ───────────────────────────────────────────────────────────────────
if (logoutBtn) logoutBtn.addEventListener('click', logout);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val, fallback = '—') {
  return (val !== undefined && val !== null && val !== '') ? val : fallback;
}

function fmtCurrency(amount, currency = 'INR') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function addActivity(icon, title, subtitle, color = 'var(--primary)') {
  if (!activityFeed) return;
  // Clear placeholder on first real item
  if (activityFeed.querySelector('strong')?.textContent === 'Dashboard loaded') {
    activityFeed.innerHTML = '';
  }
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.innerHTML = `
    <div class="activity-dot" style="background:${color};"></div>
    <div>
      <strong>${icon} ${title}</strong>
      <span>${subtitle}</span>
    </div>`;
  activityFeed.appendChild(row);
}

// ─── Set greeting & date ──────────────────────────────────────────────────────
if (timeGreet)    timeGreet.textContent = timeGreeting();
if (todayDateEl) {
  const now = new Date();
  todayDateEl.textContent = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ─── Pre-populate from cached user ───────────────────────────────────────────
const cachedUser = Auth.getUser();
if (cachedUser) {
  if (greetingName)   greetingName.textContent  = cachedUser.fullName?.split(' ')[0] || 'there';
  if (userAvatarText) userAvatarText.textContent = initials(cachedUser.fullName);
  if (userFullName)   userFullName.textContent   = fmt(cachedUser.fullName);
}

// ─── Load dashboard ───────────────────────────────────────────────────────────
async function loadDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7); // YYYY-MM

  const [profileRes, attendanceRes, balanceRes, payrollRes, leavesRes] =
    await Promise.allSettled([
      api.getMyProfile(),
      api.getMyAttendance({ view: 'daily', date: today }),
      api.getMyLeaveBalance(),
      api.getMyPayroll(),
      api.getMyLeaves({ limit: 5 }),
    ]);

  // ── Profile ────────────────────────────────────────────────────────
  if (profileRes.status === 'fulfilled') {
    const p    = profileRes.value.data;
    const name = p.fullName || cachedUser?.fullName || 'Employee';
    if (greetingName)    greetingName.textContent   = name.split(' ')[0];
    if (userAvatarText)  userAvatarText.textContent  = initials(name);
    if (userFullName)    userFullName.textContent    = name;
    if (userDesignation) {
      userDesignation.textContent =
        fmt(p.jobDetails?.designation, fmt(p.jobDetails?.department, 'Employee'));
    }
    addActivity('👤', 'Profile loaded', `${p.jobDetails?.designation || 'Employee'} · ${p.jobDetails?.department || ''}`);
  }

  // ── Attendance ─────────────────────────────────────────────────────
  if (attendanceEl) {
    if (attendanceRes.status === 'fulfilled') {
      const records     = attendanceRes.value.data;
      const todayRecord = Array.isArray(records) ? records.find(r => r.date === today) : null;

      if (!todayRecord?.checkIn) {
        attendanceEl.textContent = 'Not checked in';
        attendanceEl.style.color = 'var(--orange)';
        localStorage.setItem('dayflowAttendanceStatus', 'idle');
        addActivity('◷', 'Not checked in yet', 'Go to Attendance to start your day', 'var(--orange)');
      } else if (todayRecord.checkOut) {
        attendanceEl.textContent = 'Checked out ✓';
        attendanceEl.style.color = 'var(--green)';
        localStorage.setItem('dayflowAttendanceStatus', 'completed');
        const checkinTime  = new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const checkoutTime = new Date(todayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        addActivity('✅', 'Workday completed', `Checked in ${checkinTime} · out ${checkoutTime}`, 'var(--green)');
        if (heroTitle) heroTitle.textContent = 'Great work today!';
      } else {
        attendanceEl.textContent = 'Checked in ✓';
        attendanceEl.style.color = 'var(--green)';
        localStorage.setItem('dayflowAttendanceStatus', 'working');
        localStorage.setItem('dayflowCheckedIn', 'true');
        const checkinTime = new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        addActivity('◷', 'Checked in', `Working since ${checkinTime}`, 'var(--primary)');
        if (heroTitle) heroTitle.textContent = 'You are in flow.';
      }
    }
  }

  // ── Leave balance ──────────────────────────────────────────────────
  if (balanceRes.status === 'fulfilled') {
    const b     = balanceRes.value.data;
    const total = (b.paid ?? 0) + (b.sick ?? 0);
    if (leaveBalanceEl) leaveBalanceEl.textContent = `${total} Days`;
    if (insightText) {
      insightText.textContent =
        total > 10
          ? `You have ${b.paid} annual and ${b.sick} sick leave days available. Plan ahead to keep your team informed.`
          : `You have ${total} leave day${total !== 1 ? 's' : ''} remaining. Use them wisely before year end.`;
    }
  }

  // ── Payroll ────────────────────────────────────────────────────────
  if (payrollRes.status === 'fulfilled') {
    const p = payrollRes.value.data;
    if (netSalaryEl) netSalaryEl.textContent = fmtCurrency(p.netSalary, p.currency);
    const effDate = p.effectiveFrom
      ? new Date(p.effectiveFrom).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : '';
    addActivity('₹', 'Latest payroll available', effDate ? `Effective ${effDate}` : 'View your payslip', 'var(--secondary)');
  }

  // ── Recent leaves ──────────────────────────────────────────────────
  if (leavesRes.status === 'fulfilled') {
    const items = leavesRes.value.data.items || [];
    const pending = items.filter(l => l.status === 'PENDING');
    if (pending.length > 0) {
      addActivity('☷', `${pending.length} leave request${pending.length > 1 ? 's' : ''} pending`, 'Waiting for admin approval', 'var(--orange)');
    }
    const recentDecided = items.find(l => l.status !== 'PENDING');
    if (recentDecided) {
      const typeLabel = recentDecided.leaveType === 'PAID' ? 'Annual' : recentDecided.leaveType === 'SICK' ? 'Sick' : 'Personal';
      const statusLabel = recentDecided.status === 'APPROVED' ? '✅ Approved' : '❌ Rejected';
      addActivity('☷', `${typeLabel} leave ${statusLabel}`, `${recentDecided.startDate} → ${recentDecided.endDate}`,
        recentDecided.status === 'APPROVED' ? 'var(--green)' : 'var(--red)');
    }
  }

  // ── Monthly attendance count ───────────────────────────────────────
  try {
    const monthStart = `${thisMonth}-01`;
    const monthEnd   = today;
    const monthRes   = await api.getMyAttendance({ startDate: monthStart, endDate: monthEnd });
    const presentDays = (monthRes.data || []).filter(r => r.status === 'PRESENT' || r.status === 'HALF_DAY').length;
    if (heroScore) heroScore.textContent = presentDays;
  } catch (_) {
    if (heroScore) heroScore.textContent = '—';
  }

  // ── Admin panel ────────────────────────────────────────────────────
  if (Auth.isAdmin()) {
    const adminLink = document.getElementById('adminLink');
    if (adminLink) adminLink.style.display = 'flex';
    if (adminPanel) adminPanel.style.display = 'block';
    if (adminQuickStats) {
      try {
        const [pendingLeavesRes, empRes] = await Promise.allSettled([
          api.listAllLeaves({ status: 'PENDING', limit: 1 }),
          api.listEmployees({ limit: 1 }),
        ]);
        const pendingCount = pendingLeavesRes.status === 'fulfilled'
          ? pendingLeavesRes.value.data.pagination?.total ?? 0 : 0;
        const empCount = empRes.status === 'fulfilled'
          ? empRes.value.data.pagination?.total ?? 0 : 0;
        adminQuickStats.innerHTML = `
          ⏳ <b>${pendingCount}</b> pending leave request${pendingCount !== 1 ? 's' : ''}<br>
          👥 <b>${empCount}</b> total employees`;
      } catch (_) {}
    }
    addActivity('⚙', 'Admin mode active', 'You have full management access', 'var(--orange)');
  }
}

loadDashboard();
initNotificationBell();
