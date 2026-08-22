const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const {
  registerRules,
  loginRules,
  verifyEmailRules,
  refreshRules,
  forgotPasswordRules,
  resetPasswordRules,
} = require('../middleware/validators/authValidators');

const router = express.Router();

// Stricter limiter for brute-force-prone endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again shortly.' },
  },
});

router.post('/register', authLimiter, registerRules, validate, authController.register);
router.post('/verify-email', verifyEmailRules, validate, authController.verifyEmail);
router.post('/login', authLimiter, loginRules, validate, authController.login);
router.post('/refresh', refreshRules, validate, authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', authLimiter, forgotPasswordRules, validate, authController.forgotPassword);
router.post('/reset-password', resetPasswordRules, validate, authController.resetPassword);

module.exports = router;
