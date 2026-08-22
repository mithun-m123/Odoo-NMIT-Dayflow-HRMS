const { body } = require('express-validator');

const applyLeaveRules = [
  body('leaveType').isIn(['PAID', 'SICK', 'UNPAID']).withMessage('leaveType must be PAID, SICK, or UNPAID'),
  body('startDate').isISO8601().withMessage('startDate must be a valid date (YYYY-MM-DD)'),
  body('endDate').isISO8601().withMessage('endDate must be a valid date (YYYY-MM-DD)'),
  body('remarks').optional().isString().isLength({ max: 500 }),
];

const decideLeaveRules = [
  body('decision').isIn(['APPROVED', 'REJECTED']).withMessage('decision must be APPROVED or REJECTED'),
  body('comment').optional().isString().isLength({ max: 500 }),
];

module.exports = { applyLeaveRules, decideLeaveRules };
