const bcrypt = require('bcryptjs');
const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
  accessTokenTtlSeconds,
} = require('../utils/tokens');

const SALT_ROUNDS = 12;

// POST /auth/register
const register = asyncHandler(async (req, res) => {
  const { employeeId, fullName, email, password, role } = req.body;

  const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { employeeId }] });
  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'email' : 'employeeId';
    throw new AppError(409, 'DUPLICATE_' + field.toUpperCase(), `An account with this ${field} already exists`);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { raw, hash } = generateOpaqueToken();

  const user = await User.create({
    employeeId,
    fullName,
    email: email.toLowerCase(),
    passwordHash,
    role: role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
    status: 'PENDING_VERIFICATION',
    emailVerificationTokenHash: hash,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await LeaveBalance.create({ employeeId: user.employeeId });

  // In production this raw token is emailed to the user, never returned in the API response.
  // Logged here only so the flow is testable without an email provider configured.
  console.log(`[auth] Verification token for ${user.email}: ${raw}`);

  res.status(201).json({
    success: true,
    data: {
      userId: user._id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    message: 'Verification email sent',
  });
});

// POST /auth/verify-email
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user) {
    throw new AppError(400, 'INVALID_TOKEN', 'Verification token is invalid or has expired');
  }

  user.status = 'ACTIVE';
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.status(200).json({ success: true, message: 'Email verified successfully' });
});

// POST /auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  // Same generic error for "no such user" and "wrong password" to avoid enumeration
  const genericError = () => new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

  if (!user) throw genericError();

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw genericError();

  if (user.status === 'PENDING_VERIFICATION') {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in');
  }
  if (user.status === 'DISABLED') {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  res.status(200).json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      expiresIn: accessTokenTtlSeconds(),
      user: {
        userId: user._id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        role: user.role,
      },
    },
  });
});

// POST /auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError(400, 'VALIDATION_ERROR', 'refreshToken is required');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Refresh token has been revoked');
  }

  const accessToken = signAccessToken(user);
  res.status(200).json({
    success: true,
    data: { accessToken, expiresIn: accessTokenTtlSeconds() },
  });
});

// POST /auth/logout
const logout = asyncHandler(async (req, res) => {
  req.user.refreshTokenHash = undefined;
  await req.user.save();
  res.status(204).send();
});

// POST /auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  // Always respond 200 regardless of whether the account exists, to avoid enumeration
  if (user) {
    const { raw, hash } = generateOpaqueToken();
    user.passwordResetTokenHash = hash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    console.log(`[auth] Password reset token for ${user.email}: ${raw}`);
  }

  res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent' });
});

// POST /auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');

  if (!user) {
    throw new AppError(400, 'INVALID_TOKEN', 'Reset token is invalid or has expired');
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = undefined; // force re-login on all devices
  await user.save();

  res.status(200).json({ success: true, message: 'Password reset successfully' });
});

module.exports = { register, verifyEmail, login, refresh, logout, forgotPassword, resetPassword };
