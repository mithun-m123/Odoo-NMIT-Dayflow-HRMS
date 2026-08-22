const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        'REGISTRATION_REQUEST',  // sent to admin when a new user registers
        'REGISTRATION_APPROVED', // sent to employee when admin approves
        'REGISTRATION_REJECTED', // sent to employee when admin rejects
        'LEAVE_REQUEST',
        'LEAVE_STATUS_CHANGED',
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
