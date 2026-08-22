const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const jobDetailsSchema = new mongoose.Schema(
  {
    designation: { type: String, default: '' },
    department: { type: String, default: '' },
    dateOfJoining: { type: Date },
    reportingTo: { type: String, default: null }, // employeeId of manager
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['EMPLOYEE', 'ADMIN'], default: 'EMPLOYEE' },
    status: {
      type: String,
      enum: ['PENDING_VERIFICATION', 'ACTIVE', 'DISABLED'],
      default: 'PENDING_VERIFICATION',
    },

    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    profilePictureUrl: { type: String, default: '' },

    jobDetails: { type: jobDetailsSchema, default: () => ({}) },
    documents: { type: [documentSchema], default: [] },

    // Email verification
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // Password reset
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Refresh token rotation - store only a hash, never the raw token
    refreshTokenHash: { type: String, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
