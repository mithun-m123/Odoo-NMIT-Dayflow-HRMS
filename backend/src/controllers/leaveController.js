const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Attendance = require('../models/Attendance');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

function daysBetweenInclusive(start, end) {
  const ms = new Date(end) - new Date(start);
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

function dateRange(start, end) {
  const dates = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// POST /leaves
const applyLeave = asyncHandler(async (req, res) => {
  const employeeId = req.user.employeeId;
  const { leaveType, startDate, endDate, remarks } = req.body;

  if (new Date(endDate) < new Date(startDate)) {
    throw new AppError(422, 'INVALID_DATE_RANGE', 'endDate cannot be before startDate');
  }

  // Reject overlap with an existing pending/approved leave
  const overlap = await Leave.findOne({
    employeeId,
    status: { $in: ['PENDING', 'APPROVED'] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (overlap) {
    throw new AppError(409, 'LEAVE_OVERLAP', 'You already have a leave request overlapping these dates');
  }

  const requestedDays = daysBetweenInclusive(startDate, endDate);

  if (leaveType === 'PAID' || leaveType === 'SICK') {
    const balance = await LeaveBalance.findOne({ employeeId });
    const available = leaveType === 'PAID' ? balance?.paid ?? 0 : balance?.sick ?? 0;
    if (requestedDays > available) {
      throw new AppError(
        422,
        'INSUFFICIENT_BALANCE',
        `Available ${leaveType.toLowerCase()} leave balance is ${available} day(s), requested ${requestedDays}`
      );
    }
  }

  const leave = await Leave.create({ employeeId, leaveType, startDate, endDate, remarks: remarks || '' });
  res.status(201).json({ success: true, data: leave });
});

// GET /leaves/me
const getMyLeaves = asyncHandler(async (req, res) => {
  const filter = { employeeId: req.user.employeeId };
  if (req.query.status) filter.status = req.query.status;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

  const [items, total] = await Promise.all([
    Leave.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Leave.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /leaves/me/balance
const getMyBalance = asyncHandler(async (req, res) => {
  const balance = await LeaveBalance.findOne({ employeeId: req.user.employeeId });
  res.status(200).json({
    success: true,
    data: { paid: balance?.paid ?? 0, sick: balance?.sick ?? 0, unpaid: 'unlimited' },
  });
});

// DELETE /leaves/:leaveId — employee, only while PENDING
const cancelLeave = asyncHandler(async (req, res) => {
  const leave = await Leave.findOne({ _id: req.params.leaveId, employeeId: req.user.employeeId });
  if (!leave) throw new AppError(404, 'LEAVE_NOT_FOUND', 'Leave request not found');
  if (leave.status !== 'PENDING') {
    throw new AppError(422, 'CANNOT_CANCEL', 'Only pending leave requests can be cancelled');
  }
  await leave.deleteOne();
  res.status(204).send();
});

// GET /leaves — admin only
const listAllLeaves = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.employeeId) filter.employeeId = req.query.employeeId;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const [items, total] = await Promise.all([
    Leave.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Leave.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// PATCH /leaves/:leaveId/decision — admin only
const decideLeave = asyncHandler(async (req, res) => {
  const { decision, comment } = req.body;

  const leave = await Leave.findById(req.params.leaveId);
  if (!leave) throw new AppError(404, 'LEAVE_NOT_FOUND', 'Leave request not found');
  if (leave.status !== 'PENDING') {
    throw new AppError(422, 'ALREADY_DECIDED', 'This leave request has already been decided');
  }

  leave.status = decision;
  leave.decision = { decidedBy: req.user.employeeId, comment: comment || '', decidedOn: new Date() };
  await leave.save();

  if (decision === 'APPROVED') {
    const requestedDays = daysBetweenInclusive(leave.startDate, leave.endDate);

    if (leave.leaveType === 'PAID' || leave.leaveType === 'SICK') {
      const field = leave.leaveType === 'PAID' ? 'paid' : 'sick';
      await LeaveBalance.findOneAndUpdate(
        { employeeId: leave.employeeId },
        { $inc: { [field]: -requestedDays } }
      );
    }

    // Sync attendance for each day of the approved leave
    const dates = dateRange(leave.startDate, leave.endDate);
    await Promise.all(
      dates.map((date) =>
        Attendance.findOneAndUpdate(
          { employeeId: leave.employeeId, date },
          { employeeId: leave.employeeId, date, status: 'LEAVE' },
          { upsert: true, new: true }
        )
      )
    );
  }

  await notificationService.dispatch({
    employeeId: leave.employeeId,
    type: 'LEAVE_STATUS_CHANGED',
    title: `Leave request ${decision.toLowerCase()}`,
    body: `Your ${leave.leaveType.toLowerCase()} leave from ${leave.startDate} to ${leave.endDate} was ${decision.toLowerCase()}.`,
    meta: { leaveId: leave._id },
  });

  res.status(200).json({ success: true, data: leave });
});

module.exports = { applyLeave, getMyLeaves, getMyBalance, cancelLeave, listAllLeaves, decideLeave };
