/**
 * login.js — Handles Sign In and Sign Up per SRS 3.1.1 / 3.1.2
 */

// Already logged in → skip to dashboard
if (Auth.isLoggedIn()) window.location.href = 'index.html';

// ─── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function clearMsg(elId) {
  const el = document.getElementById(elId);
  if (el) el.style.display = 'none';
}

// ─── SIGN IN ──────────────────────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
const signInBtn = document.getElementById('signInBtn');

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('loginError');

  const email    = document.getElementById('signInEmail').value.trim();
  const password = document.getElementById('signInPassword').value;

  if (!email || !password) { showError('loginError', 'Please fill in all fields.'); return; }

  signInBtn.disabled     = true;
  signInBtn.textContent  = 'Signing in…';

  try {
    const res = await api.login(email, password);
    Auth.setSession({
      accessToken:  res.data.accessToken,
      refreshToken: res.data.refreshToken,
      user:         res.data.user,
    });
    window.location.href = 'index.html';
  } catch (err) {
    const msg =
      err.code === 'PENDING_APPROVAL'     ? '⏳ Your account is awaiting admin approval. You will receive access once HR activates your account.' :
      err.code === 'INVALID_CREDENTIALS'  ? 'Incorrect email or password.'           :
      err.code === 'EMAIL_NOT_VERIFIED'   ? 'Please verify your email first.'        :
      err.code === 'ACCOUNT_DISABLED'     ? (err.message || 'Account disabled. Contact HR.') :
      err.message || 'Login failed. Please try again.';
    showError('loginError', msg);
    signInBtn.disabled    = false;
    signInBtn.textContent = 'Enter Dayflow →';
  }
});

// ─── SIGN UP ──────────────────────────────────────────────────────────────────
const registerForm = document.getElementById('registerForm');
const signUpBtn    = document.getElementById('signUpBtn');

registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('registerError');
  clearMsg('registerSuccess');

  const employeeId = document.getElementById('regEmployeeId').value.trim();
  const role       = document.getElementById('regRole').value;
  const fullName   = document.getElementById('regFullName').value.trim();
  const email      = document.getElementById('regEmail').value.trim();
  const password   = document.getElementById('regPassword').value;
  const confirm    = document.getElementById('regConfirm').value;

  if (!employeeId || !fullName || !email || !password) {
    showError('registerError', 'All fields are required.'); return;
  }
  if (password !== confirm) {
    showError('registerError', 'Passwords do not match.'); return;
  }
  if (password.length < 8) {
    showError('registerError', 'Password must be at least 8 characters.'); return;
  }
  if (!/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    showError('registerError', 'Password must include a number and a special character.'); return;
  }

  signUpBtn.disabled    = true;
  signUpBtn.textContent = 'Creating account…';

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ employeeId, fullName, email, password, role }),
    });

    const successEl = document.getElementById('registerSuccess');
    if (successEl) {
      successEl.textContent = '✅ Registration submitted! An admin will review and activate your account. You will be able to sign in once approved.';
      successEl.style.display = 'block';
    }
    registerForm.reset();

    // Auto-switch to sign in tab after 2s
    setTimeout(() => {
      document.querySelector('[data-tab="signin"]').click();
    }, 2500);

  } catch (err) {
    const msg =
      err.code === 'DUPLICATE_EMAIL'       ? 'An account with this email already exists.'       :
      err.code === 'DUPLICATE_EMPLOYEEID'  ? 'An account with this Employee ID already exists.' :
      err.message || 'Registration failed. Please try again.';
    showError('registerError', msg);
  } finally {
    signUpBtn.disabled    = false;
    signUpBtn.textContent = 'Create Account →';
  }
});
