/**
 * attendance.js — Check-in/out, daily timeline, weekly view (SRS 3.4.1)
 */

requireAuth();

// ─── DOM ──────────────────────────────────────────────────────────────────────
const checkInBtn        = document.getElementById('checkInBtn');
const breakBtn          = document.getElementById('breakBtn');
const checkOutBtn       = document.getElementById('checkOutBtn');
const workTimer         = document.getElementById('workTimer');
const breakTimeDisplay  = document.getElementById('breakTime');
const checkInTimeDisplay = document.getElementById('checkInTime');
const workStatusEl      = document.getElementById('workStatus');
const attendanceStatus  = document.getElementById('attendanceStatus');
const timerCircle       = document.getElementById('timerCircle');
const progressFill      = document.getElementById('progressFill');
const progressText      = document.getElementById('progressText');
const attendanceHistory = document.getElementById('attendanceHistory');
const toast             = document.getElementById('toast');
const logoutBtn         = document.getElementById('logoutBtn');

if (logoutBtn) logoutBtn.addEventListener('click', logout);

// ─── State ────────────────────────────────────────────────────────────────────
let workInterval;
let breakInterval;
let serverCheckInTime = null;
let localBreakStart   = null;
let totalBreakSeconds = 0;

// ─── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll('.att-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.att-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.att-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
    if (btn.dataset.panel === 'weekly') renderWeek(weekOffset);
  });
});

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('liveClock');
  if (el) el.textContent = new Date().toLocaleTimeString();
}
updateClock();
setInterval(updateClock, 1000);

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtSecs(s) {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

function addHistory(activity, statusLabel) {
  if (!attendanceHistory) return;
  const empty = attendanceHistory.querySelector('td[colspan]');
  if (empty) attendanceHistory.innerHTML = '';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const cls  = statusLabel === 'Completed' ? 'approved' : statusLabel === 'Break' ? 'pending' : 'pending';
  const row  = document.createElement('tr');
  row.innerHTML = `<td>${activity}</td><td>${time}</td><td><span class="status ${cls}">${statusLabel}</span></td>`;
  attendanceHistory.prepend(row);
}

function setButtonState(state) {
  checkInBtn.disabled  = state !== 'idle';
  breakBtn.disabled    = state !== 'working' && state !== 'break';
  checkOutBtn.disabled = state !== 'working' && state !== 'break';
  breakBtn.textContent = state === 'break' ? '▶ End Break' : '☕ Break';

  const statusMap = {
    idle:      { text: 'READY TO START', cls: '' },
    working:   { text: 'WORKING NOW',    cls: 'working' },
    break:     { text: 'ON BREAK',       cls: 'break' },
    completed: { text: 'WORKDAY DONE',   cls: 'completed' },
  };
  const s = statusMap[state] || statusMap.idle;
  if (attendanceStatus) { attendanceStatus.textContent = s.text; attendanceStatus.className = `att-status-badge ${s.cls}`; }

  const wsMap = { idle: 'Not Started', working: 'Working', break: 'On Break', completed: 'Completed' };
  if (workStatusEl) workStatusEl.textContent = wsMap[state] || 'Not Started';
}

// ─── Timer update ─────────────────────────────────────────────────────────────
function updateWorkTimer() {
  if (!serverCheckInTime) return;
  const workedSecs = Math.max(0, Math.floor((Date.now() - new Date(serverCheckInTime).getTime()) / 1000) - totalBreakSeconds);
  if (workTimer) workTimer.textContent = fmtSecs(workedSecs);
  const pct = Math.min((workedSecs / (8 * 3600)) * 100, 100);
  if (progressFill) progressFill.style.width = pct + '%';
  if (progressText) progressText.textContent  = Math.floor(pct) + '%';
  if (timerCircle) {
    const deg = pct * 3.6;
    timerCircle.style.background =
      `conic-gradient(var(--primary) ${deg}deg, var(--secondary) ${deg + 20}deg, #ebe8ff ${deg + 20}deg)`;
  }
}

function updateBreakTimer() {
  if (!localBreakStart) return;
  const cur = totalBreakSeconds + Math.floor((Date.now() - localBreakStart) / 1000);
  if (breakTimeDisplay) breakTimeDisplay.textContent = fmtSecs(cur);
}

// ─── Check In ─────────────────────────────────────────────────────────────────
checkInBtn?.addEventListener('click', async () => {
  checkInBtn.disabled = true; checkInBtn.textContent = 'Checking in…';
  try {
    const res = await api.checkIn();
    serverCheckInTime = res.data.checkIn;
    localStorage.setItem('dayflowAttendanceStatus', 'working');
    localStorage.setItem('dayflowCheckedIn', 'true');
    const t = new Date(res.data.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem('dayflowCheckInTime', t);
    if (checkInTimeDisplay) checkInTimeDisplay.textContent = t;
    setButtonState('working');
    addHistory('Checked In', 'Completed');
    clearInterval(workInterval);
    workInterval = setInterval(updateWorkTimer, 1000);
    updateWorkTimer();
    showToast('🎉 Checked in successfully!');
  } catch (err) {
    if (err.code === 'ALREADY_CHECKED_IN') { showToast('Already checked in today.'); setButtonState('working'); }
    else showToast('Check-in failed: ' + (err.message || 'Error'));
    checkInBtn.disabled = false;
  }
  checkInBtn.textContent = '▶ Check In';
});

// ─── Break ────────────────────────────────────────────────────────────────────
breakBtn?.addEventListener('click', () => {
  const s = localStorage.getItem('dayflowAttendanceStatus');
  if (s === 'working') {
    localBreakStart = Date.now();
    localStorage.setItem('dayflowAttendanceStatus', 'break');
    clearInterval(workInterval);
    setButtonState('break');
    addHistory('Break Started', 'Break');
    breakInterval = setInterval(updateBreakTimer, 1000);
    showToast('☕ Enjoy your break!');
  } else if (s === 'break') {
    if (localBreakStart) { totalBreakSeconds += Math.floor((Date.now() - localBreakStart) / 1000); localBreakStart = null; }
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
checkOutBtn?.addEventListener('click', async () => {
  if (localStorage.getItem('dayflowAttendanceStatus') === 'break') {
    showToast('Please end your break before checking out.'); return;
  }
  checkOutBtn.disabled = true; checkOutBtn.textContent = 'Checking out…';
  try {
    await api.checkOut();
    clearInterval(workInterval); clearInterval(breakInterval);
    localStorage.setItem('dayflowAttendanceStatus', 'completed');
    localStorage.setItem('dayflowCheckedIn', 'false');
    setButtonState('completed');
    addHistory('Checked Out', 'Completed');
    showToast('🎉 Great work! See you tomorrow.');
  } catch (err) {
    if (err.code === 'ALREADY_CHECKED_OUT') { showToast('Already checked out.'); setButtonState('completed'); }
    else { showToast('Check-out failed: ' + (err.message || 'Error')); checkOutBtn.disabled = false; }
  }
  checkOutBtn.textContent = '■ Check Out';
});

// ─── Restore on page load ─────────────────────────────────────────────────────
async function restoreAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res    = await api.getMyAttendance({ view: 'daily', date: today });
    const record = (Array.isArray(res.data) ? res.data : []).find(r => r.date === today);
    if (!record?.checkIn) { setButtonState('idle'); return; }
    serverCheckInTime = record.checkIn;
    const t = new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (checkInTimeDisplay) checkInTimeDisplay.textContent = t;
    if (record.checkOut) {
      const workedSecs = Math.floor((new Date(record.checkOut) - new Date(record.checkIn)) / 1000);
      if (workTimer) workTimer.textContent = fmtSecs(workedSecs);
      const pct = Math.min((workedSecs / (8 * 3600)) * 100, 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent  = Math.floor(pct) + '%';
      setButtonState('completed');
    } else {
      setButtonState('working');
      clearInterval(workInterval);
      workInterval = setInterval(updateWorkTimer, 1000);
      updateWorkTimer();
    }
  } catch (_) {
    const s = localStorage.getItem('dayflowAttendanceStatus') || 'idle';
    setButtonState(['working','break','completed'].includes(s) ? s : 'idle');
    if (s === 'working') {
      clearInterval(workInterval); workInterval = setInterval(updateWorkTimer, 1000);
    }
  }
}
restoreAttendance();

// ─── WEEKLY VIEW (SRS 3.4.1) ─────────────────────────────────────────────────
let weekOffset = 0; // 0 = this week, -1 = last week, etc.

function getWeekRange(offset = 0) {
  const now  = new Date();
  const day  = now.getDay(); // 0=Sun
  const mon  = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function statusInfo(s) {
  if (!s) return { label: 'No Record',  cls: '',           bg: '#f3f4f6', color: '#6b7280' };
  if (s === 'PRESENT')  return { label: 'Present',  cls: 'approved', bg: 'var(--green-light)',  color: 'var(--green)' };
  if (s === 'HALF_DAY') return { label: 'Half Day', cls: 'pending',  bg: 'var(--orange-light)', color: 'var(--orange)' };
  if (s === 'LEAVE')    return { label: 'Leave',    cls: '',         bg: 'var(--primary-light)', color: 'var(--primary)' };
  if (s === 'ABSENT')   return { label: 'Absent',   cls: 'rejected', bg: 'var(--red-light)',    color: 'var(--red)' };
  return { label: s, cls: '', bg: '#f3f4f6', color: '#6b7280' };
}

async function renderWeek(offset) {
  const grid = document.getElementById('weeklyGrid');
  const label = document.getElementById('weekLabel');
  if (!grid) return;

  const days = getWeekRange(offset);
  const start = days[0], end = days[6];
  const today = new Date().toISOString().slice(0, 10);

  if (label) {
    const s = new Date(start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const e = new Date(end).toLocaleDateString('en-IN',   { day: 'numeric', month: 'short', year: 'numeric' });
    label.textContent = `${s} – ${e}`;
  }

  grid.innerHTML = '<p style="text-align:center;color:var(--muted);padding:24px;">Loading…</p>';

  try {
    const res     = await api.getMyAttendance({ startDate: start, endDate: end });
    const records = Array.isArray(res.data) ? res.data : [];
    const byDate  = Object.fromEntries(records.map(r => [r.date, r]));

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    grid.innerHTML = '';

    days.forEach((dateStr, i) => {
      const r   = byDate[dateStr];
      const isToday   = dateStr === today;
      const isWeekend = i >= 5;
      const info = isWeekend && !r ? { label: 'Weekend', cls: '', bg: '#f8f8fc', color: '#9ca3af' } : statusInfo(r?.status);

      const checkin  = r?.checkIn  ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      const checkout = r?.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      let worked = '—';
      if (r?.checkIn && r?.checkOut) {
        const secs = Math.floor((new Date(r.checkOut) - new Date(r.checkIn)) / 1000);
        worked = `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
      }

      const card = document.createElement('div');
      card.className = `week-day-card${isToday ? ' today' : ''}`;
      card.innerHTML = `
        <div>
          <div class="week-day-name">${dayNames[i]} ${isToday ? '<span style="color:var(--primary);font-size:12px;">· Today</span>' : ''}</div>
          <div class="week-day-date">${new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
        </div>
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:13px;color:var(--muted);">In: <strong>${checkin}</strong></span>
          <span style="font-size:13px;color:var(--muted);">Out: <strong>${checkout}</strong></span>
          <span style="font-size:13px;color:var(--muted);">Worked: <strong>${worked}</strong></span>
        </div>
        <span class="status" style="background:${info.bg};color:${info.color};">${info.label}</span>
      `;
      grid.appendChild(card);
    });
  } catch (_) {
    grid.innerHTML = '<p style="text-align:center;color:var(--muted);padding:24px;">Could not load weekly data.</p>';
  }
}

document.getElementById('prevWeekBtn')?.addEventListener('click', () => { weekOffset--; renderWeek(weekOffset); });
document.getElementById('nextWeekBtn')?.addEventListener('click', () => { weekOffset++; renderWeek(weekOffset); });
