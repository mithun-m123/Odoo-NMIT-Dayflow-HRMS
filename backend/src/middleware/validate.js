const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Run after an array of express-validator checks.
 * Collects any failures and throws a single AppError so the global
 * error handler can format it consistently.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({ field: e.path, issue: e.msg }));
  return next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details));
}

module.exports = validate;
