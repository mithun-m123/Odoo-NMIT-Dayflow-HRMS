const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Employee routes
router.get('/me', notificationController.getMyNotifications);
router.patch('/me/read-all', notificationController.markAllAsRead);
router.patch('/:notificationId/read', notificationController.markAsRead);

// Admin routes — unread leave requests count for badge
router.get('/admin/pending-count', requireRole('ADMIN'), notificationController.getPendingLeaveCount);

module.exports = router;
