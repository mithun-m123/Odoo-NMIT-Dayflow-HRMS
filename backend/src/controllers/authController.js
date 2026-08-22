const bcrypt = require('bcryptjs');
const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');
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

  // New accounts sit in PENDING_APPROVAL — an admin must activate them before login is possible.
  const user = await User.create({
    employeeId,
    fullName,
    email: email.toLowerCase(),
    passwordHash,
    role: role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
    status: 'PENDING_APPROVAL',
  });

  await LeaveBalance.create({ employeeId: user.employeeId });

  // Notify every active admin about the new registration
  const admins = await User.find({ role: 'ADMIN', status: 'ACTIVE' }).select('employeeId');
  const roleLabel = user.role === 'ADMIN' ? 'HR / Admin' : 'Employee';

  await Promise.all(
    admins.map((admin) =>
      notificationService.dispatch({
        employeeId: admin.employeeId,
        type: 'REGISTRATION_REQUEST',
        targetRole: 'ADMIN',
        title: 'New registration awaiting approval',
        body: `${fullName} (${employeeId}) registered as ${roleLabel}. Review and approve or reject in the Admin Portal.`,
        meta: {
          newUserId:    user._id.toString(),
          newEmployeeId: employeeId,
          newFullName:   fullName,
          newEmail:      email.toLowerCase(),
          newRole:       user.role,
        },
      })
    )
  );

  console.log(`[auth] New registration pending approval: ${user.email} (${user.employeeId})`);

  res.status(201).json({
    success: true,
    data: {
      userId:     user._id,
      employeeId: user.employeeId,
      email:      user.email,
      role:       user.role,
      status:     user.status,
    },
    message: 'Registration submitted. An admin will review and activate your account.',
  });
});

// POST /auth/verify-email  (kept for legacy — not used in new flow)
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user) throw new AppError(400, 'INVALID_TOKEN', 'Verification token is invalid or has expired');

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

  const genericError = () =>
    new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

  if (!user) throw genericError();

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw genericError();

  // ── Status gate ─────────────────────────────────────────────────────────────
  if (user.status === 'PENDING_APPROVAL') {
    throw new AppError(
      403,
      'PENDING_APPROVAL',
      'Your account is awaiting admin approval. You will be able to log in once an admin activates your account.'
    );
  }
  if (user.status === 'PENDING_VERIFICATION') {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in');
  }
  if (user.status === 'DISABLED') {
    throw new AppError(
      403,
      'ACCOUNT_DISABLED',
      user.approvalNote
        ? `Your account has been rejected: ${user.approvalNote}`
        : 'Your account has been disabled. Contact HR.'
    );
  }

  const accessToken  = signAccessToken(user);
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
        userId:     user._id,
        employeeId: user.employeeId,
        fullName:   user.fullName,
        role:       user.role,
      },
    },
  });
});

// POST /auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError(400, 'VALIDATION_ERROR', 'refreshToken is required');

  let payload;
  try { payload = verifyRefreshToken(refreshToken); }
  catch { throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired refresh token'); }

  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Refresh token has been revoked');
  }

  const accessToken = signAccessToken(user);
  res.status(200).json({ success: true, data: { accessToken, expiresIn: accessTokenTtlSeconds() } });
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

  if (!user) throw new AppError(400, 'INVALID_TOKEN', 'Reset token is invalid or has expired');

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires   = undefined;
  user.refreshTokenHash       = undefined;
  await user.save();

  res.status(200).json({ success: true, message: 'Password reset successfully' });
});

module.exports = {
  register, verifyEmail, login, refresh, logout, forgotPassword, resetPassword,
};
