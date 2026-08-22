const express = require('express');
const leaveController = require('../controllers/leaveController');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { applyLeaveRules, decideLeaveRules } = require('../middleware/validators/leaveValidators');

const router = express.Router();

router.use(authenticate);

router.post('/', applyLeaveRules, validate, leaveController.applyLeave);
router.get('/me', leaveController.getMyLeaves);
router.get('/me/balance', leaveController.getMyBalance);
router.delete('/:leaveId', leaveController.cancelLeave);

router.get('/', requireRole('ADMIN'), leaveController.listAllLeaves);
router.patch(
  '/:leaveId/decision',
  requireRole('ADMIN'),
  decideLeaveRules,
  validate,
  leaveController.decideLeave
);

module.exports = router;
