/**
 * Creates one active Admin user and one active Employee user so you can log
 * in immediately without going through the email verification flow.
 * Run with: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');

async function seed() {
  await connectDB();

  const passwordHash = await bcrypt.hash('Password!123', 12);

  const admin = await User.findOneAndUpdate(
    { email: 'admin@dayflow.com' },
    {
      employeeId: 'EMP1000',
      fullName: 'Admin User',
      email: 'admin@dayflow.com',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      jobDetails: { designation: 'HR Officer', department: 'HR', dateOfJoining: new Date() },
    },
    { upsert: true, new: true }
  );

  const employee = await User.findOneAndUpdate(
    { email: 'employee@dayflow.com' },
    {
      employeeId: 'EMP1001',
      fullName: 'Sample Employee',
      email: 'employee@dayflow.com',
      passwordHash,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      jobDetails: { designation: 'Software Engineer', department: 'Engineering', dateOfJoining: new Date() },
    },
    { upsert: true, new: true }
  );

  await LeaveBalance.findOneAndUpdate(
    { employeeId: admin.employeeId },
    { employeeId: admin.employeeId },
    { upsert: true }
  );
  await LeaveBalance.findOneAndUpdate(
    { employeeId: employee.employeeId },
    { employeeId: employee.employeeId },
    { upsert: true }
  );

  console.log('Seeded users:');
  console.log('  Admin    -> admin@dayflow.com / Password!123');
  console.log('  Employee -> employee@dayflow.com / Password!123');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
