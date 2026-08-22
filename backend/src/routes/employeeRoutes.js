const express = require('express');
const employeeController = require('../controllers/employeeController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/me', employeeController.getMyProfile);
router.patch('/me', employeeController.updateMyProfile);
router.post('/me/profile-picture', employeeController.uploadMyProfilePicture);

router.get('/', requireRole('ADMIN'), employeeController.listEmployees);
router.get('/:employeeId', requireRole('ADMIN'), employeeController.getEmployeeById);
router.patch('/:employeeId', requireRole('ADMIN'), employeeController.updateEmployee);

module.exports = router;
