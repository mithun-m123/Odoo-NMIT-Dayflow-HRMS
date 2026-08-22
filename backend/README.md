# Dayflow HRMS — Backend

Node.js + Express + MongoDB (Mongoose) implementation of the `backend` branch
scope: authentication, employee/profile, attendance, leave, payroll, and
notification APIs.

## 1. Requirements

- Node.js 18+
- A MongoDB instance — either:
  - Local MongoDB (`mongod` running on `localhost:27017`), or
  - A free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas) (recommended if you don't want to install MongoDB locally)

## 2. Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in real values
cp .env.example .env
```

Edit `.env`:
```
MONGO_URI=mongodb://127.0.0.1:27017/dayflow_hrms   # or your Atlas connection string
JWT_ACCESS_SECRET=<any long random string>
JWT_REFRESH_SECRET=<a different long random string>
```

You can generate strong secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Run

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

The server starts on `http://localhost:5000` by default. Check it's alive:

```bash
curl http://localhost:5000/health
```

## 4. Seed test users (optional but recommended)

Registering through `/v1/auth/register` requires email verification, and this
project doesn't wire up a real email provider (it logs the verification token
to the console instead — see §6). For a quick start, seed two pre-verified
accounts:

```bash
npm run seed
```

This creates:
| Role     | Email                  | Password       |
|----------|-------------------------|----------------|
| Admin    | admin@dayflow.com       | Password!123   |
| Employee | employee@dayflow.com    | Password!123   |

## 5. Try it out

```bash
# Log in
curl -X POST http://localhost:5000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"employee@dayflow.com","password":"Password!123"}'

# Use the returned accessToken
curl http://localhost:5000/v1/employees/me \
  -H "Authorization: Bearer <accessToken>"

# Check in
curl -X POST http://localhost:5000/v1/attendance/check-in \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

All routes are documented with sample payloads in
`Dayflow_Backend_API_Specification.md` (shared separately). The route prefix
in this implementation is `/v1` (e.g. `/v1/auth/login`, `/v1/leaves`, etc.)
matching the versioning note in that spec.

## 6. Notes / things intentionally stubbed for a drag-and-drop demo

- **Email sending** is not wired to a real provider. Verification and
  password-reset tokens are logged to the console (`[auth] Verification token
  for ...`) instead of emailed — copy that token into the relevant endpoint to
  continue the flow. Swap in a real provider (e.g. Nodemailer + SMTP, SendGrid)
  inside `authController.js` where indicated.
- **Profile picture upload** (`POST /employees/me/profile-picture`) expects
  `req.uploadedFileUrl` to already be set by an upstream file-upload
  middleware (e.g. `multer` + S3/Cloudinary). That middleware isn't included
  here — wire it in `employeeRoutes.js` before the controller if you need this
  endpoint.
- **Notifications** are stored in MongoDB and exposed via
  `GET /v1/notifications/me`; no email/push channel is wired up yet, but
  `src/services/notificationService.js` is the single place to add one later.

## 7. Project structure

```
src/
  app.js              Express app (middleware + route mounting)
  server.js           Entry point (env, DB connection, listen)
  config/db.js        Mongoose connection
  models/             User, Attendance, Leave, LeaveBalance, Payroll, Notification
  middleware/          auth (JWT + RBAC), validate, errorHandler, validators/
  controllers/        Route handler logic per module
  routes/             Express routers per module
  services/           notificationService (decoupled dispatch layer)
  utils/               AppError, asyncHandler, tokens, seed
```

## 8. Git workflow reminder (per Dayflow branch responsibilities doc)

- Work on the `backend` branch only.
- Do not push directly to `main`.
- Open a Pull Request into `main` once a feature is ready and verified.
