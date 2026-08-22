const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['LEAVE_STATUS_CHANGED', 'PAYROLL_UPDATED', 'ATTENDANCE_UPDATED'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
