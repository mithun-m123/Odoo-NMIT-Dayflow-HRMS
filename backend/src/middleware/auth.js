const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const User = require('../models/User');

/**
 * Verifies the Bearer access token, loads the user, and attaches it to req.user.
 * Never trust a role/employeeId claim without re-checking the account still
 * exists and is active - tokens can outlive account state changes.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header');
    }

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Account no longer exists');
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_INACTIVE', 'Account is not active');
    }

    req.user = user; // full mongoose doc (minus passwordHash)
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err); // JWT errors handled by global error handler
  }
}

/**
 * Role-based access control. Usage: requireRole('ADMIN')
 * Must run after `authenticate`.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
