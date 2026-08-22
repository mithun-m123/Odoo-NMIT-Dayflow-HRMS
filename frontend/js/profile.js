/**
 * profile.js — Loads and updates employee profile via backend API
 */

requireAuth();

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', logout);

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const fullNameInput  = document.getElementById('fullName');
const emailInput     = document.getElementById('email');
const phoneInput     = document.getElementById('phone');
const departmentSel  = document.getElementById('department');
const employeeIdInput = document.getElementById('employeeId');

const profileName    = document.getElementById('profileName');
const profileRole    = document.getElementById('profileRole');
const avatarEl       = document.getElementById('avatar');

const displayEmployeeId  = document.getElementById('displayEmployeeId');
const displayDepartment  = document.getElementById('displayDepartment');
const displayDesignation = document.getElementById('displayDesignation');
const displayJoining     = document.getElementById('displayJoining');

const saveBtn = document.getElementById('saveProfile');
const toast   = document.getElementById('toast');

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';
}

function fmt(val, fallback = '—') {
  return val !== undefined && val !== null && val !== '' ? val : fallback;
}

// ─── Render profile ───────────────────────────────────────────────────────────

function renderProfile(p) {
  const name       = p.fullName || '';
  const dept       = p.jobDetails?.department || '';
  const desig      = p.jobDetails?.designation || '';
  const joined     = p.jobDetails?.dateOfJoining
    ? new Date(p.jobDetails.dateOfJoining).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  // Hero section
  if (avatarEl)    avatarEl.textContent    = initials(name);
  if (profileName) profileName.textContent = fmt(name, 'Employee');
  if (profileRole) profileRole.textContent = desig ? `${desig}${dept ? ' · ' + dept : ''}` : (dept || 'Dayflow Team Member');

  // Form fields (read-only info)
  if (fullNameInput)   fullNameInput.value   = fmt(name, '');
  if (emailInput)      emailInput.value      = fmt(p.email, '');
  if (phoneInput)      phoneInput.value      = fmt(p.phone, '');
  if (employeeIdInput) employeeIdInput.value = fmt(p.employeeId, '');

  // Department select
  if (departmentSel && dept) {
    const options = Array.from(departmentSel.options).map(o => o.value);
    if (options.includes(dept)) {
      departmentSel.value = dept;
    }
  }

  // Side info panel
  if (displayEmployeeId)  displayEmployeeId.textContent  = fmt(p.employeeId, '—');
  if (displayDepartment)  displayDepartment.textContent  = fmt(dept, '—');
  if (displayDesignation) displayDesignation.textContent = fmt(desig, '—');
  if (displayJoining)     displayJoining.textContent     = joined;
}

// ─── Load profile from backend ────────────────────────────────────────────────

async function loadProfile() {
  try {
    const res = await api.getMyProfile();
    renderProfile(res.data);
  } catch (err) {
    // Fallback to cached user from token
    const user = Auth.getUser();
    if (user) {
      if (profileName) profileName.textContent = user.fullName || 'Employee';
      if (avatarEl)    avatarEl.textContent    = initials(user.fullName);
      if (emailInput)  emailInput.value        = '';
    }
    console.warn('Profile load failed:', err.message);
  }
}

// ─── Save profile ─────────────────────────────────────────────────────────────

if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    const phone   = phoneInput?.value.trim()   || '';
    const address = document.getElementById('address')?.value.trim() || '';

    if (!phone && !address) {
      showToast('Enter at least one field to update (phone or address).');
      return;
    }

    saveBtn.disabled     = true;
    saveBtn.textContent  = 'Saving…';

    const updates = {};
    if (phone)   updates.phone   = phone;
    if (address) updates.address = address;

    try {
      const res = await api.updateMyProfile(updates);
      renderProfile(res.data);
      showToast('✓ Profile updated successfully!');
    } catch (err) {
      showToast('Update failed: ' + (err.message || 'Unknown error'));
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadProfile();
initNotificationBell();
