/**
 * login.js — Authenticates user via POST /v1/auth/login
 * Stores tokens + user in localStorage via Auth, then redirects to dashboard.
 */

// If already logged in, skip login page
if (Auth.isLoggedIn()) {
  window.location.href = 'index.html';
}

const loginForm    = document.getElementById('loginForm');
const emailInput   = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn    = loginForm.querySelector('button[type="submit"]');

// Error display element — injected below the form if not already in HTML
let errorBox = document.getElementById('loginError');
if (!errorBox) {
  errorBox = document.createElement('p');
  errorBox.id = 'loginError';
  errorBox.style.cssText =
    'color:#ef4444;font-size:13px;margin-top:12px;text-align:center;display:none;';
  loginForm.appendChild(errorBox);
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
}

function clearError() {
  errorBox.style.display = 'none';
}

loginForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  clearError();

  const email    = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showError('Please enter your email and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in…';

  try {
    const res = await api.login(email, password);

    // Store tokens + user info
    Auth.setSession({
      accessToken:  res.data.accessToken,
      refreshToken: res.data.refreshToken,
      user:         res.data.user,
    });

    // Redirect to dashboard
    window.location.href = 'index.html';

  } catch (err) {
    const msg = err.code === 'INVALID_CREDENTIALS'
      ? 'Incorrect email or password.'
      : err.code === 'EMAIL_NOT_VERIFIED'
        ? 'Please verify your email before logging in.'
        : err.code === 'ACCOUNT_DISABLED'
          ? 'Your account has been disabled. Contact HR.'
          : err.message || 'Login failed. Please try again.';

    showError(msg);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enter Dayflow →';
  }
});
