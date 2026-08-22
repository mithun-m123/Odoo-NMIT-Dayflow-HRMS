const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/me', notificationController.getMyNotifications);
router.patch('/me/read-all', notificationController.markAllAsRead);
router.patch('/:notificationId/read', notificationController.markAsRead);

module.exports = router;
