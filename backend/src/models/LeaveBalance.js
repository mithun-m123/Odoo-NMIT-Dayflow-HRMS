const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, index: true },
    paid: { type: Number, default: 12 },
    sick: { type: Number, default: 8 },
    // unpaid leave has no cap, so it is not tracked here
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
