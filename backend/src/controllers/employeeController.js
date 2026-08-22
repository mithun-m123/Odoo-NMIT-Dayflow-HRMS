const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

function toProfileDto(user) {
  return {
    employeeId:       user.employeeId,
    fullName:         user.fullName,
    email:            user.email,
    phone:            user.phone,
    address:          user.address,
    profilePictureUrl: user.profilePictureUrl,
    jobDetails:       user.jobDetails,
    documents:        user.documents,
    status:           user.status,
    role:             user.role,
    approvalNote:     user.approvalNote,
    approvedBy:       user.approvedBy,
    approvedAt:       user.approvedAt,
    createdAt:        user.createdAt,
  };
}

// GET /employees/me
const getMyProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: toProfileDto(req.user) });
});

// PATCH /employees/me — limited self-edit
const EMPLOYEE_EDITABLE_FIELDS = ['phone', 'address', 'profilePictureUrl'];

const updateMyProfile = asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of EMPLOYEE_EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0) {
    throw new AppError(422, 'NO_VALID_FIELDS', 'No editable fields were provided');
  }
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.status(200).json({ success: true, data: toProfileDto(user) });
});

// POST /employees/me/profile-picture
const uploadMyProfilePicture = asyncHandler(async (req, res) => {
  if (!req.uploadedFileUrl) throw new AppError(400, 'NO_FILE', 'No file was uploaded');
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { profilePictureUrl: req.uploadedFileUrl },
    { new: true }
  );
  res.status(200).json({ success: true, data: { profilePictureUrl: user.profilePictureUrl } });
});

// GET /employees/pending — admin only, lists accounts awaiting approval
const listPendingRegistrations = asyncHandler(async (req, res) => {
  const page  = Math.max(parseInt(req.query.page,  10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

  const filter = { status: 'PENDING_APPROVAL' };

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('employeeId fullName email role status createdAt approvalNote')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      items: items.map((u) => ({
        _id:          u._id,
        employeeId:   u.employeeId,
        fullName:     u.fullName,
        email:        u.email,
        role:         u.role,
        status:       u.status,
        createdAt:    u.createdAt,
        approvalNote: u.approvalNote,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

// PATCH /employees/:employeeId/approve — admin only
const approveEmployee = asyncHandler(async (req, res) => {
  const { note = '', jobDetails } = req.body;

  const user = await User.findOne({ employeeId: req.params.employeeId });
  if (!user) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  if (user.status !== 'PENDING_APPROVAL') {
    throw new AppError(422, 'NOT_PENDING', 'This account is not pending approval');
  }

  user.status      = 'ACTIVE';
  user.approvedBy  = req.user.employeeId;
  user.approvedAt  = new Date();
  user.approvalNote = note;
  if (jobDetails) user.jobDetails = { ...user.jobDetails.toObject(), ...jobDetails };
  await user.save();

  // Notify the employee their account is active
  await notificationService.dispatch({
    employeeId: user.employeeId,
    type: 'REGISTRATION_APPROVED',
    targetRole: 'EMPLOYEE',
    title: '✅ Account approved — welcome to Dayflow!',
    body: `Your account has been approved by HR. You can now sign in with your registered email.${note ? ` Note: "${note}"` : ''}`,
    meta: { approvedBy: req.user.employeeId },
  });

  console.log(`[onboarding] ${user.employeeId} approved by ${req.user.employeeId}`);
  res.status(200).json({ success: true, data: toProfileDto(user) });
});

// PATCH /employees/:employeeId/reject — admin only
const rejectEmployee = asyncHandler(async (req, res) => {
  const { note = 'Registration rejected by HR.' } = req.body;

  const user = await User.findOne({ employeeId: req.params.employeeId });
  if (!user) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  if (user.status !== 'PENDING_APPROVAL') {
    throw new AppError(422, 'NOT_PENDING', 'This account is not pending approval');
  }

  user.status       = 'DISABLED';
  user.approvedBy   = req.user.employeeId;
  user.approvedAt   = new Date();
  user.approvalNote = note;
  await user.save();

  // Notify the employee their account was rejected
  await notificationService.dispatch({
    employeeId: user.employeeId,
    type: 'REGISTRATION_REJECTED',
    targetRole: 'EMPLOYEE',
    title: '❌ Account registration rejected',
    body: `Your registration was not approved. Reason: "${note}". Contact HR for assistance.`,
    meta: { rejectedBy: req.user.employeeId, note },
  });

  console.log(`[onboarding] ${user.employeeId} rejected by ${req.user.employeeId}`);
  res.status(200).json({ success: true, data: toProfileDto(user) });
});

// GET /employees/:employeeId — admin only
const getEmployeeById = asyncHandler(async (req, res) => {
  const user = await User.findOne({ employeeId: req.params.employeeId });
  if (!user) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  res.status(200).json({ success: true, data: toProfileDto(user) });
});

// GET /employees — admin only
const listEmployees = asyncHandler(async (req, res) => {
  const page  = Math.max(parseInt(req.query.page,  10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  // Only list ACTIVE employees by default; pass ?status=ALL to see everything
  const filter = req.query.status === 'ALL' ? {} : { status: 'ACTIVE' };

  if (req.query.department) filter['jobDetails.department'] = req.query.department;
  if (req.query.search) {
    const re = new RegExp(req.query.search, 'i');
    filter.$or = [{ fullName: re }, { employeeId: re }, { email: re }];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('employeeId fullName email role status jobDetails.designation jobDetails.department')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ fullName: 1 }),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      items: items.map((u) => ({
        employeeId:  u.employeeId,
        fullName:    u.fullName,
        email:       u.email,
        role:        u.role,
        status:      u.status,
        designation: u.jobDetails?.designation || '',
        department:  u.jobDetails?.department  || '',
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

// PATCH /employees/:employeeId — admin only, full edit
const ADMIN_EDITABLE_FIELDS = ['fullName', 'phone', 'address', 'profilePictureUrl', 'role', 'status'];

const updateEmployee = asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of ADMIN_EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (req.body.jobDetails) updates.jobDetails = req.body.jobDetails;

  const user = await User.findOneAndUpdate(
    { employeeId: req.params.employeeId },
    updates,
    { new: true, runValidators: true }
  );
  if (!user) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');

  res.status(200).json({ success: true, data: toProfileDto(user) });
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadMyProfilePicture,
  listPendingRegistrations,
  approveEmployee,
  rejectEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
};
