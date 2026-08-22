const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    leaveType: { type: String, enum: ['PAID', 'SICK', 'UNPAID'], required: true },
    startDate: { type: String, required: true }, // 'YYYY-MM-DD'
    endDate: { type: String, required: true },
    remarks: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    decision: {
      decidedBy: { type: String, default: null }, // admin employeeId
      comment: { type: String, default: '' },
      decidedOn: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Leave', leaveSchema);
