const { body } = require('express-validator');

const strongPassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .matches(/[a-z]/)
  .withMessage('Password must contain a lowercase letter')
  .matches(/[A-Z]/)
  .withMessage('Password must contain an uppercase letter')
  .matches(/\d/)
  .withMessage('Password must contain a digit')
  .matches(/[^A-Za-z0-9]/)
  .withMessage('Password must contain a special character');

const registerRules = [
  body('employeeId').trim().notEmpty().withMessage('employeeId is required'),
  body('fullName').trim().notEmpty().withMessage('fullName is required'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  strongPassword,
  body('role').optional().isIn(['EMPLOYEE', 'ADMIN']).withMessage('role must be EMPLOYEE or ADMIN'),
];

const loginRules = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('password is required'),
];

const verifyEmailRules = [body('token').notEmpty().withMessage('token is required')];

const refreshRules = [body('refreshToken').notEmpty().withMessage('refreshToken is required')];

const forgotPasswordRules = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
];

const resetPasswordRules = [
  body('token').notEmpty().withMessage('token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/)
    .matches(/[A-Z]/)
    .matches(/\d/)
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password does not meet security requirements'),
];

module.exports = {
  registerRules,
  loginRules,
  verifyEmailRules,
  refreshRules,
  forgotPasswordRules,
  resetPasswordRules,
};
