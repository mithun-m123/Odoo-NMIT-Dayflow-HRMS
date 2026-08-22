const Attendance = require('../models/Attendance');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

function toDateStr(d = new Date()) {
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// POST /attendance/check-in
const checkIn = asyncHandler(async (req, res) => {
  const employeeId = req.user.employeeId;
  const now = new Date(); // server time is authoritative, not the client-supplied timestamp
  const today = toDateStr(now);

  const existing = await Attendance.findOne({ employeeId, date: today });
  if (existing && existing.checkIn) {
    throw new AppError(409, 'ALREADY_CHECKED_IN', 'You have already checked in today');
  }

  const record = existing
    ? Object.assign(existing, { checkIn: now, status: 'PRESENT', location: req.body.location || '' })
    : new Attendance({ employeeId, date: today, checkIn: now, status: 'PRESENT', location: req.body.location || '' });

  await record.save();
  res.status(201).json({ success: true, data: record });
});

// POST /attendance/check-out
const checkOut = asyncHandler(async (req, res) => {
  const employeeId = req.user.employeeId;
  const now = new Date();
  const today = toDateStr(now);

  const record = await Attendance.findOne({ employeeId, date: today });
  if (!record || !record.checkIn) {
    throw new AppError(422, 'NOT_CHECKED_IN', 'You must check in before checking out');
  }
  if (record.checkOut) {
    throw new AppError(409, 'ALREADY_CHECKED_OUT', 'You have already checked out today');
  }

  record.checkOut = now;

  const hoursWorked = (record.checkOut - record.checkIn) / (1000 * 60 * 60);
  const halfDayThreshold = Number(process.env.HALF_DAY_THRESHOLD_HOURS) || 4;
  record.status = hoursWorked < halfDayThreshold ? 'HALF_DAY' : 'PRESENT';

  await record.save();
  res.status(200).json({ success: true, data: record });
});

// GET /attendance/me
const getMyAttendance = asyncHandler(async (req, res) => {
  const data = await queryAttendance(req.user.employeeId, req.query);
  res.status(200).json({ success: true, data });
});

// GET /attendance/:employeeId — admin only
const getAttendanceByEmployee = asyncHandler(async (req, res) => {
  const data = await queryAttendance(req.params.employeeId, req.query);
  res.status(200).json({ success: true, data });
});

async function queryAttendance(employeeId, query) {
  const filter = { employeeId };

  if (query.view === 'daily' && query.date) {
    filter.date = query.date;
  } else if (query.startDate && query.endDate) {
    filter.date = { $gte: query.startDate, $lte: query.endDate };
  }

  return Attendance.find(filter).sort({ date: 1 });
}

// GET /attendance — admin only, org-wide listing
const listAllAttendance = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const filter = {};

  if (req.query.date) filter.date = req.query.date;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.employeeId) filter.employeeId = req.query.employeeId;

  const [items, total] = await Promise.all([
    Attendance.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ date: -1 }),
    Attendance.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// PATCH /attendance/:attendanceId — admin only, manual correction
const updateAttendance = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;

  const record = await Attendance.findById(req.params.attendanceId);
  if (!record) throw new AppError(404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found');

  record.status = status;
  record.manualEdit = { isManual: true, reason: reason || '', updatedBy: req.user.employeeId };
  await record.save();

  await notificationService.dispatch({
    employeeId: record.employeeId,
    type: 'ATTENDANCE_UPDATED',
    title: 'Attendance record updated',
    body: `Your attendance for ${record.date} was manually updated to ${status}.`,
    meta: { attendanceId: record._id, date: record.date },
  });

  res.status(200).json({ success: true, data: record });
});

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getAttendanceByEmployee,
  listAllAttendance,
  updateAttendance,
};
