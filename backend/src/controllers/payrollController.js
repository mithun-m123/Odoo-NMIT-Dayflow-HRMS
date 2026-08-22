const Payroll = require('../models/Payroll');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

async function getLatestStructure(employeeId) {
  return Payroll.findOne({ employeeId }).sort({ effectiveFrom: -1 });
}

function toPayrollDto(p) {
  return {
    employeeId: p.employeeId,
    currency: p.currency,
    basic: p.basic,
    hra: p.hra,
    allowances: p.allowances,
    deductions: p.deductions,
    netSalary: p.netSalary,
    effectiveFrom: p.effectiveFrom,
  };
}

// GET /payroll/me
const getMyPayroll = asyncHandler(async (req, res) => {
  const record = await getLatestStructure(req.user.employeeId);
  if (!record) throw new AppError(404, 'PAYROLL_NOT_FOUND', 'No payroll structure found for this employee');
  res.status(200).json({ success: true, data: toPayrollDto(record) });
});

// GET /payroll/:employeeId — admin only
const getPayrollByEmployee = asyncHandler(async (req, res) => {
  const record = await getLatestStructure(req.params.employeeId);
  if (!record) throw new AppError(404, 'PAYROLL_NOT_FOUND', 'No payroll structure found for this employee');
  res.status(200).json({ success: true, data: toPayrollDto(record) });
});

// GET /payroll — admin only, org-wide listing (latest structure per employee)
const listAllPayroll = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const items = await Payroll.aggregate([
    { $sort: { employeeId: 1, effectiveFrom: -1 } },
    { $group: { _id: '$employeeId', latest: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$latest' } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ]);

  res.status(200).json({ success: true, data: { items: items.map(toPayrollDto), page, limit } });
});

// PUT /payroll/:employeeId — admin only, creates a new versioned structure
const updateSalaryStructure = asyncHandler(async (req, res) => {
  const { basic, hra = 0, allowances = 0, deductions = 0, effectiveFrom } = req.body;

  // netSalary is always server-computed, never trusted from the client
  const netSalary = Number(basic) + Number(hra) + Number(allowances) - Number(deductions);

  const record = await Payroll.create({
    employeeId: req.params.employeeId,
    basic,
    hra,
    allowances,
    deductions,
    netSalary,
    effectiveFrom,
    updatedBy: req.user.employeeId,
  });

  await notificationService.dispatch({
    employeeId: req.params.employeeId,
    type: 'PAYROLL_UPDATED',
    title: 'Salary structure updated',
    body: `Your salary structure was updated, effective ${effectiveFrom}.`,
    meta: { payrollId: record._id },
  });

  res.status(200).json({ success: true, data: toPayrollDto(record) });
});

module.exports = { getMyPayroll, getPayrollByEmployee, listAllPayroll, updateSalaryStructure };
