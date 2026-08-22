const { body } = require('express-validator');

const updateAttendanceRules = [
  body('status')
    .isIn(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'])
    .withMessage('status must be one of PRESENT, ABSENT, HALF_DAY, LEAVE'),
  body('reason').optional().isString(),
];

module.exports = { updateAttendanceRules };
