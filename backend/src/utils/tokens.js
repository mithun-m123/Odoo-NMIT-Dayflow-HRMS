const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, employeeId: user.employeeId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// Refresh tokens are stored hashed (SHA-256) so a DB leak alone doesn't yield usable tokens.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Random opaque token used for email verification / password reset links.
// We store only the hash and email the raw value to the user.
function generateOpaqueToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashToken(raw) };
}

function accessTokenTtlSeconds() {
  const raw = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
  accessTokenTtlSeconds,
};
