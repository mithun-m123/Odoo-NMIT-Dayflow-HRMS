const { body } = require('express-validator');

const updateSalaryRules = [
  body('basic').isFloat({ min: 0 }).withMessage('basic must be a non-negative number'),
  body('hra').optional().isFloat({ min: 0 }).withMessage('hra must be a non-negative number'),
  body('allowances').optional().isFloat({ min: 0 }).withMessage('allowances must be a non-negative number'),
  body('deductions').optional().isFloat({ min: 0 }).withMessage('deductions must be a non-negative number'),
  body('effectiveFrom').isISO8601().withMessage('effectiveFrom must be a valid date (YYYY-MM-DD)'),
];

module.exports = { updateSalaryRules };
