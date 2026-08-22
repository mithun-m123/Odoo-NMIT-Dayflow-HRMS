const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function toProfileDto(user) {
  return {
    employeeId: user.employeeId,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    address: user.address,
    profilePictureUrl: user.profilePictureUrl,
    jobDetails: user.jobDetails,
    documents: user.documents,
  };
}

// GET /employees/me
const getMyProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: toProfileDto(req.user) });
});

// PATCH /employees/me — employees may only edit a whitelisted set of fields
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
// Assumes upstream middleware (e.g. multer + an image-processing step) has already
// validated MIME type/size and stripped EXIF data, and placed the final URL on req.uploadedFileUrl.
const uploadMyProfilePicture = asyncHandler(async (req, res) => {
  if (!req.uploadedFileUrl) {
    throw new AppError(400, 'NO_FILE', 'No file was uploaded');
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { profilePictureUrl: req.uploadedFileUrl },
    { new: true }
  );
  res.status(200).json({ success: true, data: { profilePictureUrl: user.profilePictureUrl } });
});

// GET /employees/:employeeId — admin only
const getEmployeeById = asyncHandler(async (req, res) => {
  const user = await User.findOne({ employeeId: req.params.employeeId });
  if (!user) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  res.status(200).json({ success: true, data: toProfileDto(user) });
});

// GET /employees — admin only, paginated + filterable
const listEmployees = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const filter = {};

  if (req.query.department) filter['jobDetails.department'] = req.query.department;
  if (req.query.search) {
    const re = new RegExp(req.query.search, 'i');
    filter.$or = [{ fullName: re }, { employeeId: re }, { email: re }];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('employeeId fullName jobDetails.designation jobDetails.department')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ fullName: 1 }),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      items: items.map((u) => ({
        employeeId: u.employeeId,
        fullName: u.fullName,
        designation: u.jobDetails?.designation || '',
        department: u.jobDetails?.department || '',
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

// PATCH /employees/:employeeId — admin only, full edit rights
const ADMIN_EDITABLE_FIELDS = ['fullName', 'phone', 'address', 'profilePictureUrl', 'role', 'status'];

const updateEmployee = asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of ADMIN_EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (req.body.jobDetails) updates.jobDetails = req.body.jobDetails;

  const user = await User.findOneAndUpdate({ employeeId: req.params.employeeId }, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');

  res.status(200).json({ success: true, data: toProfileDto(user) });
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadMyProfilePicture,
  getEmployeeById,
  listEmployees,
  updateEmployee,
};
