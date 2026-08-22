const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /notifications/me
const getMyNotifications = asyncHandler(async (req, res) => {
  const filter = { employeeId: req.user.employeeId };
  if (req.query.unreadOnly === 'true') filter.isRead = false;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const items = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.status(200).json({ success: true, data: items });
});

// PATCH /notifications/:notificationId/read
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, employeeId: req.user.employeeId },
    { isRead: true },
    { new: true }
  );
  if (!notification) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  res.status(200).json({ success: true, data: notification });
});

// PATCH /notifications/me/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ employeeId: req.user.employeeId, isRead: false }, { isRead: true });
  res.status(200).json({ success: true, message: 'All notifications marked as read' });
});

module.exports = { getMyNotifications, markAsRead, markAllAsRead };
