# hr-data — Dayflow HRMS Data Layer

Database schema, business logic, and analytics layer for the Dayflow HRMS,
built strictly against the SRS: authentication & RBAC, employee profiles,
attendance, leave/time-off, payroll, and notifications/analytics.

**Engine:** PostgreSQL 14+ (tested and verified end-to-end on PostgreSQL 16).
**Style:** raw SQL DDL/DML — portable to any ORM (Prisma/SQLAlchemy/Sequelize)
by generating models from these tables; ask if you'd like a Prisma schema
or SQLAlchemy models generated from this DDL instead.

## Folder structure

```
hr-data/
├── migrations/
│   ├── 001_core_schema.sql        # extensions, enums, users, profiles, job details, documents
│   ├── 002_attendance.sql         # attendance table + generated worked_hours
│   ├── 003_leave_management.sql   # leave_balances, leave_requests, leave_approval_logs
│   ├── 004_payroll.sql            # salary_structures, salary_slips
│   ├── 005_notifications_audit.sql# notifications, audit_logs
│   ├── 006_business_logic.sql     # triggers & functions (validation, automation)
│   └── 007_views_analytics.sql    # reporting views + analytics functions
├── seed/
│   └── seed_data.sql              # realistic sample data (5 users, attendance, leave, salary)
├── queries/
│   └── sample_analytics_queries.sql  # 10 ready-to-run dashboard/report queries
└── README.md
```

Run migrations in numeric order — each is idempotent (`CREATE ... IF NOT EXISTS`,
`ON CONFLICT DO NOTHING`) so they're safe to re-run in dev.

```bash
for f in migrations/*.sql; do psql -d dayflow_hrms -f "$f"; done
psql -d dayflow_hrms -f seed/seed_data.sql
```

## Schema overview

| Table | Purpose | Key relationships |
|---|---|---|
| `users` | Auth root: credentials, role, verification | referenced by nearly everything |
| `employee_profiles` | Personal fields, employee-editable | 1:1 `users` |
| `job_details` | Department, designation, manager, status | 1:1 `users`, self-referencing `reporting_manager_id` |
| `documents` | Uploaded files (resume, ID, contracts) | N:1 `users` |
| `attendance` | Daily check-in/out ledger | N:1 `users`, one row per `(user_id, date)` |
| `leave_balances` | Yearly quota per leave type | N:1 `users` |
| `leave_requests` | Leave applications | N:1 `users` |
| `leave_approval_logs` | Audit trail of HR/Admin decisions | N:1 `leave_requests`, `users` (approver) |
| `salary_structures` | Versioned pay components; one active row/user | N:1 `users` |
| `salary_slips` | Immutable monthly payroll output | N:1 `users`, `salary_structures` |
| `notifications` | In-app alerts | N:1 `users` |
| `audit_logs` | Generic before/after change log (JSONB) | polymorphic via `table_name`/`record_id` |

### Why generated columns are used heavily
`worked_hours`, `gross_salary`, `net_salary`, `total_days`, `remaining` (leave
balance) are all `GENERATED ALWAYS AS ... STORED`. This guarantees the
derived numbers can never drift from their source fields — the database
recomputes them on every write, so the app layer never has to.

## Business logic implemented (all verified against a live PostgreSQL 16 instance)

| Rule | Enforced by |
|---|---|
| Check-out must be after check-in | `CHECK` constraint **and** a `BEFORE` trigger with a human-readable error |
| No two PENDING/APPROVED leave requests may overlap for the same employee | `prevent_overlapping_leave()` trigger using the SQL `OVERLAPS` operator |
| Approving a leave request deducts the days from `leave_balances` (paid/sick only; unpaid leave doesn't draw down a quota) | `apply_leave_status_change()` trigger; reverses the deduction if a decision is later reversed |
| Approved leave automatically marks those days `LEAVE` in `attendance` | same trigger, upserts into `attendance` |
| Attendance status (`PRESENT` / `HALF_DAY`) is auto-derived from worked hours (≥ 4.5h = full day) | `validate_and_derive_attendance()` trigger |
| Only one `is_active = TRUE` salary structure per employee | partial unique index **+** trigger that auto-closes the prior structure's `effective_to` date |
| Employee gets an in-app notification the moment HR approves/rejects their leave | `notify_leave_decision()` trigger writing into `notifications` |
| `updated_at` timestamps stay accurate without app-layer bookkeeping | generic `set_updated_at()` trigger on all mutable tables |

## Analytics layer

Views (`v_employee_directory`, `v_daily_attendance_summary`,
`v_weekly_attendance`, `v_pending_leave_approvals`, `v_current_salary`) and
functions (`get_attendance_trend`, `get_weekly_attendance`,
`get_leave_balance`, `generate_salary_slip_preview`) back the "Analytics &
reports dashboard" requirement — attendance trends and salary-slip
generation are both queryable in a single call. See
`queries/sample_analytics_queries.sql` for 10 dashboard-ready examples
(headcount by department, leave utilization, payroll cost by department,
late check-in report, etc.).

## Validation performed

All 7 migrations, the seed file, and every sample analytics query were
executed against a real PostgreSQL 16 database during development. Confirmed
behaviors:
- Attendance rows auto-classify as `PRESENT`/`HALF_DAY` from timestamps.
- Approving Priya's leave request deducted 3 days from her `PAID` balance,
  marked Sep 1–3 as `LEAVE` in attendance, and generated a notification —
  all from a single `UPDATE ... SET status = 'APPROVED'`.
- Inserting a check-out before check-in is rejected with a clear error.
- Inserting an overlapping leave request is rejected with a clear error.
- Inserting a new active salary structure auto-closes the previous one.

## Next steps / extension points

- Add `password_reset_tokens` / `email_verification_tokens` tables when the
  auth flow (3.1.1/3.1.2) is implemented in the API layer.
- If an ORM is preferred over raw SQL for the app layer, this DDL maps
  cleanly to Prisma (`schema.prisma`) or SQLAlchemy models — happy to
  generate either on request.
- `audit_logs` is schema-ready but not yet wired to triggers; add
  `AFTER UPDATE` triggers on `salary_structures` and `users.role` if you
  want automatic before/after snapshots for compliance.
