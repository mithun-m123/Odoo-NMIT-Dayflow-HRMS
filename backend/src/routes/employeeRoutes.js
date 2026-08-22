const express = require('express');
const employeeController = require('../controllers/employeeController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Employee self-service
router.get('/me', employeeController.getMyProfile);
router.patch('/me', employeeController.updateMyProfile);
router.post('/me/profile-picture', employeeController.uploadMyProfilePicture);

// Admin — onboarding approval flow
router.get('/pending', requireRole('ADMIN'), employeeController.listPendingRegistrations);
router.patch('/:employeeId/approve', requireRole('ADMIN'), employeeController.approveEmployee);
router.patch('/:employeeId/reject',  requireRole('ADMIN'), employeeController.rejectEmployee);

// Admin — general employee management
router.get('/',              requireRole('ADMIN'), employeeController.listEmployees);
router.get('/:employeeId',   requireRole('ADMIN'), employeeController.getEmployeeById);
router.patch('/:employeeId', requireRole('ADMIN'), employeeController.updateEmployee);

module.exports = router;
