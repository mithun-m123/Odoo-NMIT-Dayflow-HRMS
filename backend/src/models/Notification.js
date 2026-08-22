const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        'LEAVE_REQUEST',        // sent to admin when employee submits leave
        'LEAVE_STATUS_CHANGED', // sent to employee when admin decides
        'PAYROLL_UPDATED',
        'ATTENDANCE_UPDATED',
      ],
      required: true,
    },
    // for admin-targeted notifications employeeId holds the admin's employeeId
    targetRole: { type: String, enum: ['EMPLOYEE', 'ADMIN', 'ALL'], default: 'EMPLOYEE' },
    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
