/**
 * app.js — Dashboard page
 * Loads real data: profile, today's attendance, leave balance, latest payroll.
 */

requireAuth();

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const greetingName     = document.getElementById('greetingName');
const userAvatarText   = document.getElementById('userAvatarText');
const userFullName     = document.getElementById('userFullName');
const userDesignation  = document.getElementById('userDesignation');
const attendanceStatus = document.getElementById('attendanceStatus');
const leaveBalance     = document.getElementById('leaveBalance');
const netSalary        = document.getElementById('netSalary');
const logoutBtn        = document.getElementById('logoutBtn');

// ─── Logout ───────────────────────────────────────────────────────────────────

if (logoutBtn) logoutBtn.addEventListener('click', logout);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val, fallback = '—') {
  return val !== undefined && val !== null && val !== '' ? val : fallback;
}

function fmtCurrency(amount, currency = 'INR') {
  if (amount === undefined || amount === null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';
}

// ─── Load dashboard data ──────────────────────────────────────────────────────

async function loadDashboard() {
  const user = Auth.getUser();

  // Populate from cached token payload immediately for instant render
  if (user) {
    if (greetingName)    greetingName.textContent   = user.fullName?.split(' ')[0] || 'there';
    if (userAvatarText)  userAvatarText.textContent  = initials(user.fullName);
    if (userFullName)    userFullName.textContent    = fmt(user.fullName);
  }

  // Fetch profile, attendance, balance, payroll in parallel
  const today = new Date().toISOString().slice(0, 10);

  const [profileRes, attendanceRes, balanceRes, payrollRes] = await Promise.allSettled([
    api.getMyProfile(),
    api.getMyAttendance({ view: 'daily', date: today }),
    api.getMyLeaveBalance(),
    api.getMyPayroll(),
  ]);

  // Profile
  if (profileRes.status === 'fulfilled') {
    const p = profileRes.value.data;
    const name = p.fullName || user?.fullName || 'Employee';
    if (greetingName)   greetingName.textContent   = name.split(' ')[0];
    if (userAvatarText) userAvatarText.textContent  = initials(name);
    if (userFullName)   userFullName.textContent    = name;
    if (userDesignation) {
      userDesignation.textContent =
        fmt(p.jobDetails?.designation, fmt(p.jobDetails?.department, 'Employee'));
    }
  }

  // Today's attendance
  if (attendanceStatus) {
    if (attendanceRes.status === 'fulfilled') {
      const records = attendanceRes.value.data;
      const todayRecord = Array.isArray(records)
        ? records.find(r => r.date === today)
        : null;

      if (!todayRecord || !todayRecord.checkIn) {
        attendanceStatus.textContent = 'Not checked in';
      } else if (todayRecord.checkOut) {
        attendanceStatus.textContent = 'Checked out';
        localStorage.setItem('dayflowAttendanceStatus', 'completed');
        localStorage.setItem('dayflowCheckedIn', 'false');
      } else {
        attendanceStatus.textContent = 'Checked in';
        localStorage.setItem('dayflowAttendanceStatus', 'working');
        localStorage.setItem('dayflowCheckedIn', 'true');
      }
    } else {
      // Fallback to localStorage if API fails
      const cached = localStorage.getItem('dayflowAttendanceStatus');
      if (cached === 'working')    attendanceStatus.textContent = 'Checked in';
      else if (cached === 'completed') attendanceStatus.textContent = 'Checked out';
      else attendanceStatus.textContent = 'Not checked in';
    }
  }

  // Leave balance
  if (leaveBalance) {
    if (balanceRes.status === 'fulfilled') {
      const b = balanceRes.value.data;
      const total = (b.paid ?? 0) + (b.sick ?? 0);
      leaveBalance.textContent = `${total} Days`;
    }
  }

  // Payroll
  if (netSalary) {
    if (payrollRes.status === 'fulfilled') {
      netSalary.textContent = fmtCurrency(payrollRes.value.data.netSalary, payrollRes.value.data.currency);
    }
    // If 404 (no payroll yet), show a dash — handled by default "—" text in HTML
  }
}

loadDashboard();

// Show admin portal link if user is admin
if (Auth.isAdmin()) {
  const adminLink = document.getElementById('adminLink');
  if (adminLink) adminLink.style.display = 'flex';
}

// Start notification bell
initNotificationBell();
