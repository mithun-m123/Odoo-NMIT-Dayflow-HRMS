/**
 * attendance.js — Real check-in/check-out via backend API
 * Server time is authoritative. Local timers are display-only.
 */

requireAuth();

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const checkInBtn        = document.getElementById('checkInBtn');
const breakBtn          = document.getElementById('breakBtn');
const checkOutBtn       = document.getElementById('checkOutBtn');
const workTimer         = document.getElementById('workTimer');
const breakTimeDisplay  = document.getElementById('breakTime');
const checkInTimeDisplay = document.getElementById('checkInTime');
const workStatus        = document.getElementById('workStatus');
const attendanceStatus  = document.getElementById('attendanceStatus');
const timerCircle       = document.getElementById('timerCircle');
const progressFill      = document.getElementById('progressFill');
const progressText      = document.getElementById('progressText');
const attendanceHistory = document.getElementById('attendanceHistory');
const toast             = document.getElementById('toast');
const logoutBtn         = document.getElementById('logoutBtn');

if (logoutBtn) logoutBtn.addEventListener('click', logout);

// ─── State (from server on load, then tracked locally) ───────────────────────

let workInterval;
let breakInterval;
let serverCheckInTime = null; // ISO string from DB
let localBreakStart   = null;
let totalBreakSeconds = 0;

// ─── Live clock ───────────────────────────────────────────────────────────────

function updateClock() {
  const el = document.getElementById('liveClock');
  if (el) el.textContent = new Date().toLocaleTimeString();
}
updateClock();
setInterval(updateClock, 1000);

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function addHistory(activity, statusLabel) {
  if (!attendanceHistory) return;
  const empty = attendanceHistory.querySelector('td[colspan]');
  if (empty) attendanceHistory.innerHTML = '';

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${activity}</td>
    <td>${time}</td>
    <td><span class="status ${statusLabel === 'Completed' ? 'approved' : 'pending'}">${statusLabel}</span></td>
  `;
  attendanceHistory.prepend(row);
}

function setButtonState(state) {
  // state: 'idle' | 'working' | 'break' | 'completed'
  checkInBtn.disabled  = state !== 'idle';
  breakBtn.disabled    = state !== 'working' && state !== 'break';
  checkOutBtn.disabled = state !== 'working' && state !== 'break';

  if (state === 'idle') {
    attendanceStatus.textContent = 'READY TO START';
    attendanceStatus.className   = 'status';
    workStatus.textContent       = 'Not Started';
  } else if (state === 'working') {
    attendanceStatus.textContent = 'WORKING NOW';
    attendanceStatus.className   = 'status working';
    workStatus.textContent       = 'Working';
    breakBtn.textContent         = '☕ Start Break';
  } else if (state === 'break') {
    attendanceStatus.textContent = 'ON BREAK';
    attendanceStatus.className   = 'status break';
    workStatus.textContent       = 'On Break';
    breakBtn.textContent         = '▶ End Break';
  } else if (state === 'completed') {
    attendanceStatus.textContent = 'WORKDAY COMPLETED';
    attendanceStatus.className   = 'status completed';
    workStatus.textContent       = 'Completed';
  }
}

// ─── Timer logic ──────────────────────────────────────────────────────────────

function updateWorkTimer() {
  if (!serverCheckInTime) return;

  const checkInMs    = new Date(serverCheckInTime).getTime();
  const workedSeconds = Math.floor((Date.now() - checkInMs) / 1000) - totalBreakSeconds;
  workTimer.textContent = formatTime(Math.max(workedSeconds, 0));

  const goalSeconds = 8 * 3600;
  const pct = Math.min((workedSeconds / goalSeconds) * 100, 100);
  if (progressFill) progressFill.style.width = pct + '%';
  if (progressText) progressText.textContent  = Math.floor(pct) + '%';
  if (timerCircle) {
    const deg = pct * 3.6;
    timerCircle.style.background =
      `conic-gradient(#635bff ${deg}deg, #8b5cf6 ${deg + 20}deg, #ecebff ${deg + 20}deg)`;
  }
}

function updateBreakTimer() {
  if (!localBreakStart) return;
  const currentBreak = totalBreakSeconds + Math.floor((Date.now() - localBreakStart) / 1000);
  if (breakTimeDisplay) breakTimeDisplay.textContent = formatTime(currentBreak);
}

// ─── Check In ─────────────────────────────────────────────────────────────────

checkInBtn.addEventListener('click', async () => {
  checkInBtn.disabled = true;
  checkInBtn.textContent = 'Checking in…';
  try {
    const res = await api.checkIn();
    const record = res.data;

    serverCheckInTime = record.checkIn;
    localStorage.setItem('dayflowAttendanceStatus', 'working');
    localStorage.setItem('dayflowCheckedIn', 'true');
    localStorage.setItem('dayflowCheckInTime', new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    if (checkInTimeDisplay) {
      checkInTimeDisplay.textContent = localStorage.getItem('dayflowCheckInTime');
    }

    setButtonState('working');
    addHistory('Checked In', 'Completed');
    clearInterval(workInterval);
    workInterval = setInterval(updateWorkTimer, 1000);
    updateWorkTimer();
    showToast('🎉 Checked in successfully!');
  } catch (err) {
    if (err.code === 'ALREADY_CHECKED_IN') {
      showToast('You have already checked in today.');
      setButtonState('working');
    } else {
      showToast('Check-in failed: ' + (err.message || 'Unknown error'));
      checkInBtn.disabled = false;
    }
    checkInBtn.textContent = '▶ Check In';
  }
});

// ─── Break ────────────────────────────────────────────────────────────────────

breakBtn.addEventListener('click', () => {
  const currentState = localStorage.getItem('dayflowAttendanceStatus');

  if (currentState === 'working') {
    // Start break
    localBreakStart = Date.now();
    localStorage.setItem('dayflowAttendanceStatus', 'break');
    clearInterval(workInterval);
    setButtonState('break');
    addHistory('Break Started', 'Break');
    breakInterval = setInterval(updateBreakTimer, 1000);
    showToast('☕ Enjoy your break!');
  } else if (currentState === 'break') {
    // End break
    if (localBreakStart) {
      totalBreakSeconds += Math.floor((Date.now() - localBreakStart) / 1000);
      localBreakStart = null;
    }
    localStorage.setItem('dayflowAttendanceStatus', 'working');
    clearInterval(breakInterval);
    setButtonState('working');
    addHistory('Break Ended', 'Completed');
    clearInterval(workInterval);
    workInterval = setInterval(updateWorkTimer, 1000);
    updateWorkTimer();
    showToast('🚀 Back to work!');
  }
});

// ─── Check Out ────────────────────────────────────────────────────────────────

checkOutBtn.addEventListener('click', async () => {
  const currentState = localStorage.getItem('dayflowAttendanceStatus');
  if (currentState === 'break') {
    showToast('Please end your break before checking out.');
    return;
  }

  checkOutBtn.disabled = true;
  checkOutBtn.textContent = 'Checking out…';

  try {
    await api.checkOut();

    clearInterval(workInterval);
    clearInterval(breakInterval);
    localStorage.setItem('dayflowAttendanceStatus', 'completed');
    localStorage.setItem('dayflowCheckedIn', 'false');
    setButtonState('completed');
    addHistory('Checked Out', 'Completed');
    showToast('🎉 Great work! See you tomorrow.');
  } catch (err) {
    if (err.code === 'ALREADY_CHECKED_OUT') {
      showToast('Already checked out for today.');
      setButtonState('completed');
    } else {
      showToast('Check-out failed: ' + (err.message || 'Unknown error'));
      checkOutBtn.disabled = false;
      checkOutBtn.textContent = '■ Check Out';
    }
  }
});

// ─── Restore state on page load ───────────────────────────────────────────────

async function restoreAttendance() {
  // Load today's real record from backend
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res     = await api.getMyAttendance({ view: 'daily', date: today });
    const records = res.data;
    const record  = Array.isArray(records) ? records.find(r => r.date === today) : null;

    if (!record || !record.checkIn) {
      setButtonState('idle');
      return;
    }

    serverCheckInTime = record.checkIn;
    if (checkInTimeDisplay) {
      checkInTimeDisplay.textContent = new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (record.checkOut) {
      // Checked out — compute totals for display
      const workedSecs = Math.floor((new Date(record.checkOut) - new Date(record.checkIn)) / 1000);
      if (workTimer) workTimer.textContent = formatTime(workedSecs);
      const pct = Math.min((workedSecs / (8 * 3600)) * 100, 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent  = Math.floor(pct) + '%';
      localStorage.setItem('dayflowAttendanceStatus', 'completed');
      localStorage.setItem('dayflowCheckedIn', 'false');
      setButtonState('completed');
    } else {
      // Still working
      localStorage.setItem('dayflowAttendanceStatus', 'working');
      localStorage.setItem('dayflowCheckedIn', 'true');
      setButtonState('working');
      clearInterval(workInterval);
      workInterval = setInterval(updateWorkTimer, 1000);
      updateWorkTimer();
    }
  } catch (_) {
    // If API fails, fall back to localStorage state
    const state = localStorage.getItem('dayflowAttendanceStatus') || 'idle';
    setButtonState(state === 'working' ? 'working' : state === 'break' ? 'break' : state === 'completed' ? 'completed' : 'idle');
    if (state === 'working' || state === 'break') {
      const savedTime = localStorage.getItem('dayflowCheckInTime');
      if (checkInTimeDisplay && savedTime) checkInTimeDisplay.textContent = savedTime;
      if (state === 'working') {
        clearInterval(workInterval);
        workInterval = setInterval(updateWorkTimer, 1000);
      }
    }
  }
}

restoreAttendance();
