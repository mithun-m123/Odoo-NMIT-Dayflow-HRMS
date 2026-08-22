-- =====================================================================
-- Sample Analytics / Reporting Queries
-- For the Admin "Analytics & reports dashboard" (SRS section 4)
-- =====================================================================

-- 1. Company-wide attendance trend, last 30 days
SELECT * FROM get_attendance_trend((CURRENT_DATE - INTERVAL '30 day')::date, CURRENT_DATE);

-- 2. Today's attendance snapshot
SELECT * FROM v_daily_attendance_summary WHERE attendance_date = CURRENT_DATE;

-- 3. Department-wise headcount
SELECT department, COUNT(*) AS headcount
FROM v_employee_directory
WHERE is_active = TRUE
GROUP BY department
ORDER BY headcount DESC;

-- 4. Leave utilization by type, current year
SELECT
    leave_type,
    SUM(total_allocated) AS total_allocated,
    SUM(used)             AS total_used,
    ROUND(100.0 * SUM(used) / NULLIF(SUM(total_allocated), 0), 1) AS utilization_pct
FROM leave_balances
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY leave_type;

-- 5. Employees currently over 80% of their paid-leave quota (early warning)
SELECT
    ed.employee_code, ed.first_name, ed.last_name, lb.leave_type, lb.total_allocated, lb.used, lb.remaining
FROM leave_balances lb
JOIN v_employee_directory ed ON ed.user_id = lb.user_id
WHERE lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND lb.total_allocated > 0
  AND (lb.used / lb.total_allocated) >= 0.8;

-- 6. Monthly payroll cost by department (based on active salary structures)
SELECT
    j.department,
    COUNT(*)                         AS employee_count,
    SUM(s.net_salary)                AS total_net_payroll,
    ROUND(AVG(s.net_salary), 2)      AS avg_net_salary
FROM v_current_salary s
JOIN job_details j ON j.user_id = s.user_id
GROUP BY j.department
ORDER BY total_net_payroll DESC;

-- 7. Pending leave-approval queue for HR/Admin dashboard
SELECT * FROM v_pending_leave_approvals;

-- 8. Salary slip preview for one employee before generating the final record
SELECT * FROM generate_salary_slip_preview(
    '11111111-1111-1111-1111-111111111103'::uuid, 8::smallint, 2026::smallint
);

-- 9. Attendance punctuality report — late check-ins (after 09:15 local time)
SELECT
    ed.employee_code, ed.first_name, ed.last_name,
    a.attendance_date, a.check_in_time
FROM attendance a
JOIN v_employee_directory ed ON ed.user_id = a.user_id
WHERE a.check_in_time::time > TIME '09:15:00'
ORDER BY a.attendance_date DESC;

-- 10. Unread notifications per user (for a bell-icon badge count)
SELECT user_id, COUNT(*) AS unread_count
FROM notifications
WHERE is_read = FALSE
GROUP BY user_id;
