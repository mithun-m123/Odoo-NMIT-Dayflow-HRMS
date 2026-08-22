const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    currency: { type: String, default: 'INR' },
    basic: { type: Number, required: true, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    allowances: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    netSalary: { type: Number, required: true }, // always server-computed, never trusted from client
    effectiveFrom: { type: String, required: true }, // 'YYYY-MM-DD'
    updatedBy: { type: String, default: null }, // admin employeeId
  },
  { timestamps: true }
);

// Most recent structure per employee is the one with the latest effectiveFrom
payrollSchema.index({ employeeId: 1, effectiveFrom: -1 });

module.exports = mongoose.model('Payroll', payrollSchema);
