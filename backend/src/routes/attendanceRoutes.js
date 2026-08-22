const express = require('express');
const attendanceController = require('../controllers/attendanceController');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateAttendanceRules } = require('../middleware/validators/attendanceValidators');

const router = express.Router();

router.use(authenticate);

router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/me', attendanceController.getMyAttendance);

router.get('/', requireRole('ADMIN'), attendanceController.listAllAttendance);
router.get('/:employeeId', requireRole('ADMIN'), attendanceController.getAttendanceByEmployee);
router.patch(
  '/:attendanceId',
  requireRole('ADMIN'),
  updateAttendanceRules,
  validate,
  attendanceController.updateAttendance
);

module.exports = router;
