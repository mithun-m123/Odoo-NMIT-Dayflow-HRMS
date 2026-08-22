const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());

// Accept one or more comma-separated origins from CORS_ORIGIN env var
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.use('/v1/auth', authRoutes);
app.use('/v1/employees', employeeRoutes);
app.use('/v1/attendance', attendanceRoutes);
app.use('/v1/leaves', leaveRoutes);
app.use('/v1/payroll', payrollRoutes);
app.use('/v1/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
