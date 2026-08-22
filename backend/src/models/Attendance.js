const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // 'YYYY-MM-DD' for simple day-level uniqueness
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'],
      default: 'ABSENT',
    },
    location: { type: String, default: '' },
    manualEdit: {
      isManual: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      updatedBy: { type: String, default: null }, // admin employeeId
    },
  },
  { timestamps: true }
);

// One attendance record per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
