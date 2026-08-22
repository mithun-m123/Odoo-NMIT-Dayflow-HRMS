const Notification = require('../models/Notification');
const Leave = require('../models/Leave');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /notifications/me
const getMyNotifications = asyncHandler(async (req, res) => {
  const filter = { employeeId: req.user.employeeId };
  if (req.query.unreadOnly === 'true') filter.isRead = false;

  const page  = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const [items, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments({ employeeId: req.user.employeeId, isRead: false }),
  ]);

  res.status(200).json({ success: true, data: items, unreadCount });
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

// GET /notifications/admin/pending-count — admin only
// Returns count of unread LEAVE_REQUEST notifications + total pending leaves
const getPendingLeaveCount = asyncHandler(async (req, res) => {
  const [unreadRequests, pendingLeaves] = await Promise.all([
    Notification.countDocuments({
      employeeId: req.user.employeeId,
      type: 'LEAVE_REQUEST',
      isRead: false,
    }),
    Leave.countDocuments({ status: 'PENDING' }),
  ]);

  res.status(200).json({
    success: true,
    data: { unreadRequests, pendingLeaves },
  });
});

module.exports = { getMyNotifications, markAsRead, markAllAsRead, getPendingLeaveCount };
