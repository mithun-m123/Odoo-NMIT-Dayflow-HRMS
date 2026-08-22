-- =====================================================================
-- Migration 007: Views & Analytics Layer
-- Backing store for "Analytics & reports dashboard" (salary slips,
-- attendance trends) referenced in the SRS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_employee_directory — flattened employee list for Admin dashboard
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_employee_directory AS
SELECT
    u.id                        AS user_id,
    u.employee_code,
    u.email,
    u.role,
    u.is_active,
    p.first_name,
    p.last_name,
    p.phone,
    p.profile_picture_url,
    j.department,
    j.designation,
    j.employment_type,
    j.date_of_joining,
    j.employment_status,
    j.reporting_manager_id,
    mgr_profile.first_name || ' ' || mgr_profile.last_name AS reporting_manager_name
FROM users u
JOIN employee_profiles p ON p.user_id = u.id
JOIN job_details j        ON j.user_id = u.id
LEFT JOIN employee_profiles mgr_profile ON mgr_profile.user_id = j.reporting_manager_id;

-- ---------------------------------------------------------------------
-- v_daily_attendance_summary — company-wide counts per day (FR 3.4.1/3.2.2)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_daily_attendance_summary AS
SELECT
    attendance_date,
    COUNT(*) FILTER (WHERE status = 'PRESENT')   AS present_count,
    COUNT(*) FILTER (WHERE status = 'ABSENT')    AS absent_count,
    COUNT(*) FILTER (WHERE status = 'HALF_DAY')  AS half_day_count,
    COUNT(*) FILTER (WHERE status = 'LEAVE')     AS leave_count,
    COUNT(*)                                     AS total_marked
FROM attendance
GROUP BY attendance_date
ORDER BY attendance_date DESC;

-- ---------------------------------------------------------------------
-- v_weekly_attendance — per-employee weekly rollup
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_weekly_attendance AS
SELECT
    user_id,
    date_trunc('week', attendance_date)::date AS week_start,
    COUNT(*) FILTER (WHERE status = 'PRESENT')  AS present_days,
    COUNT(*) FILTER (WHERE status = 'ABSENT')   AS absent_days,
    COUNT(*) FILTER (WHERE status = 'HALF_DAY') AS half_days,
    COUNT(*) FILTER (WHERE status = 'LEAVE')    AS leave_days,
    ROUND(SUM(COALESCE(worked_hours, 0)), 2)    AS total_worked_hours
FROM attendance
GROUP BY user_id, date_trunc('week', attendance_date);

-- ---------------------------------------------------------------------
-- v_pending_leave_approvals — HR/Admin approval queue (FR 3.5.2)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pending_leave_approvals AS
SELECT
    lr.id AS leave_request_id,
    lr.user_id,
    p.first_name || ' ' || p.last_name AS employee_name,
    j.department,
    lr.leave_type,
    lr.start_date,
    lr.end_date,
    lr.total_days,
    lr.remarks,
    lr.applied_at
FROM leave_requests lr
JOIN employee_profiles p ON p.user_id = lr.user_id
JOIN job_details j        ON j.user_id = lr.user_id
WHERE lr.status = 'PENDING'
ORDER BY lr.applied_at ASC;

-- ---------------------------------------------------------------------
-- v_current_salary — the one active salary structure per employee
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_current_salary AS
SELECT s.*
FROM salary_structures s
WHERE s.is_active = TRUE;

-- ---------------------------------------------------------------------
-- Function: monthly attendance trend across the whole company
-- Powers an "attendance trend" chart on the analytics dashboard.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_attendance_trend(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    attendance_date DATE,
    present_count BIGINT,
    absent_count BIGINT,
    half_day_count BIGINT,
    leave_count BIGINT,
    attendance_rate NUMERIC
) AS $$
    SELECT
        attendance_date,
        COUNT(*) FILTER (WHERE status = 'PRESENT'),
        COUNT(*) FILTER (WHERE status = 'ABSENT'),
        COUNT(*) FILTER (WHERE status = 'HALF_DAY'),
        COUNT(*) FILTER (WHERE status = 'LEAVE'),
        ROUND(
            100.0 * COUNT(*) FILTER (WHERE status IN ('PRESENT', 'HALF_DAY'))
            / NULLIF(COUNT(*), 0), 2
        ) AS attendance_rate
    FROM attendance
    WHERE attendance_date BETWEEN p_start_date AND p_end_date
    GROUP BY attendance_date
    ORDER BY attendance_date;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------
-- Function: generate a salary slip snapshot for one employee/month
-- (Reads attendance + active salary structure; does not persist —
--  the API layer inserts the result into salary_slips after review.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_salary_slip_preview(p_user_id UUID, p_month SMALLINT, p_year SMALLINT)
RETURNS TABLE (
    user_id UUID,
    salary_structure_id UUID,
    days_present NUMERIC,
    days_on_leave NUMERIC,
    gross_salary NUMERIC,
    total_deductions NUMERIC,
    net_salary NUMERIC
) AS $$
    SELECT
        s.user_id,
        s.id,
        COALESCE(att.present_days, 0),
        COALESCE(att.leave_days, 0),
        s.gross_salary,
        s.total_deductions,
        s.net_salary
    FROM salary_structures s
    LEFT JOIN (
        SELECT
            user_id,
            COUNT(*) FILTER (WHERE status IN ('PRESENT', 'HALF_DAY')) AS present_days,
            COUNT(*) FILTER (WHERE status = 'LEAVE') AS leave_days
        FROM attendance
        WHERE user_id = p_user_id
          AND EXTRACT(MONTH FROM attendance_date) = p_month
          AND EXTRACT(YEAR FROM attendance_date) = p_year
        GROUP BY user_id
    ) att ON att.user_id = s.user_id
    WHERE s.user_id = p_user_id AND s.is_active = TRUE;
$$ LANGUAGE sql STABLE;
