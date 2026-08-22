# Dayflow API Contract

## Base URL

/api

---

## Authentication

### Register
POST /auth/register

### Login
POST /auth/login

---

## Employees

### Get All Employees
GET /employees

### Get Employee
GET /employees/:id

### Update Employee
PUT /employees/:id

---

## Attendance

### Get Attendance
GET /attendance

### Check In
POST /attendance/check-in

### Check Out
POST /attendance/check-out

---

## Leave

### Apply for Leave
POST /leave

### Get Leave Requests
GET /leave

### Approve Leave
PUT /leave/:id/approve

### Reject Leave
PUT /leave/:id/reject

---

## Payroll

### Get Payroll
GET /payroll

### Update Payroll
PUT /payroll/:id

---

## Notifications

### Get Notifications
GET /notifications