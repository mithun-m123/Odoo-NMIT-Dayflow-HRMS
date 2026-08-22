-- =====================================================================
-- Migration 006: Business Logic — Triggers & Functions
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Generic updated_at maintainer
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON employee_profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON employee_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_job_details_updated_at ON job_details;
CREATE TRIGGER trg_job_details_updated_at BEFORE UPDATE ON job_details
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON attendance;
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------
-- 2. Attendance: friendly validation + auto status derivation
--    - Rejects check-out <= check-in with a clear message (belt-and-braces
--      alongside the CHECK constraint in 002_attendance.sql).
--    - If the app doesn't explicitly set status, derive it from worked hours:
--        >= 4.5h  -> PRESENT
--        > 0 - 4.5h -> HALF_DAY
--        no check-in at all and status left default -> ABSENT
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_and_derive_attendance()
RETURNS TRIGGER AS $$
DECLARE
    hours NUMERIC;
BEGIN
    IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL
       AND NEW.check_out_time <= NEW.check_in_time THEN
        RAISE EXCEPTION 'Check-out time (%) must be after check-in time (%)',
            NEW.check_out_time, NEW.check_in_time
            USING ERRCODE = '22007';
    END IF;

    -- Only auto-derive when caller hasn't explicitly marked LEAVE
    -- (LEAVE status is set by the leave-approval flow, not by check-in/out).
    IF NEW.status IS DISTINCT FROM 'LEAVE' THEN
        IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
            hours := ROUND(EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0, 2);
            NEW.status := CASE WHEN hours >= 4.5 THEN 'PRESENT'::attendance_status
                                ELSE 'HALF_DAY'::attendance_status END;
        ELSIF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NULL THEN
            NEW.status := 'PRESENT'::attendance_status;  -- checked in, day in progress
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_validate_derive ON attendance;
CREATE TRIGGER trg_attendance_validate_derive
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION validate_and_derive_attendance();


-- ---------------------------------------------------------------------
-- 3. Leave requests: prevent overlapping PENDING/APPROVED requests
--    for the same employee (uses the SQL OVERLAPS operator; no extra
--    extensions required).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_overlapping_leave()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('PENDING', 'APPROVED') AND EXISTS (
        SELECT 1
        FROM leave_requests lr
        WHERE lr.user_id = NEW.user_id
          AND lr.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND lr.status IN ('PENDING', 'APPROVED')
          AND (lr.start_date, lr.end_date + INTERVAL '1 day')
              OVERLAPS (NEW.start_date, NEW.end_date + INTERVAL '1 day')
    ) THEN
        RAISE EXCEPTION 'Employee % already has a pending/approved leave request overlapping % to %',
            NEW.user_id, NEW.start_date, NEW.end_date
            USING ERRCODE = '23P01';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leave_no_overlap ON leave_requests;
CREATE TRIGGER trg_leave_no_overlap
    BEFORE INSERT OR UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION prevent_overlapping_leave();


-- ---------------------------------------------------------------------
-- 4. Leave requests: keep leave_balances in sync when a request is
--    approved / un-approved, and log every decision to leave_approval_logs.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_leave_status_change()
RETURNS TRIGGER AS $$
DECLARE
    req_year INTEGER := EXTRACT(YEAR FROM NEW.start_date);
BEGIN
    -- Only paid/sick leave draw down a balance; unpaid leave does not.
    IF NEW.status = 'APPROVED' AND OLD.status IS DISTINCT FROM 'APPROVED'
       AND NEW.leave_type <> 'UNPAID' THEN

        INSERT INTO leave_balances (user_id, leave_type, year, total_allocated, used)
        VALUES (NEW.user_id, NEW.leave_type, req_year, 0, NEW.total_days)
        ON CONFLICT (user_id, leave_type, year)
        DO UPDATE SET used = leave_balances.used + NEW.total_days,
                       updated_at = now();

    ELSIF OLD.status = 'APPROVED' AND NEW.status IN ('REJECTED', 'CANCELLED')
          AND NEW.leave_type <> 'UNPAID' THEN

        UPDATE leave_balances
           SET used = GREATEST(0, used - OLD.total_days),
               updated_at = now()
         WHERE user_id = NEW.user_id AND leave_type = NEW.leave_type AND year = req_year;
    END IF;

    -- Reflect approved leave onto the attendance ledger for each day in range
    IF NEW.status = 'APPROVED' AND OLD.status IS DISTINCT FROM 'APPROVED' THEN
        INSERT INTO attendance (user_id, attendance_date, status)
        SELECT NEW.user_id, d::date, 'LEAVE'
        FROM generate_series(NEW.start_date, NEW.end_date, INTERVAL '1 day') AS d
        ON CONFLICT (user_id, attendance_date)
        DO UPDATE SET status = 'LEAVE', updated_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leave_status_change ON leave_requests;
CREATE TRIGGER trg_leave_status_change
    AFTER UPDATE OF status ON leave_requests
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION apply_leave_status_change();


-- ---------------------------------------------------------------------
-- 5. Notify the employee whenever their leave request is decided.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_leave_decision()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('APPROVED', 'REJECTED') AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
        VALUES (
            NEW.user_id,
            'Leave request ' || LOWER(NEW.status::text),
            'Your ' || NEW.leave_type || ' leave request from ' || NEW.start_date || ' to ' || NEW.end_date ||
                ' has been ' || LOWER(NEW.status::text) || '.',
            'APPROVAL',
            'LEAVE_REQUEST',
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_leave_decision ON leave_requests;
CREATE TRIGGER trg_notify_leave_decision
    AFTER UPDATE OF status ON leave_requests
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_leave_decision();


-- ---------------------------------------------------------------------
-- 6. Salary structures: deactivate the previous active row automatically
--    when a new one is inserted (keeps the "one active row" rule honest
--    even if the app forgets to do it explicitly).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deactivate_previous_salary_structure()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active THEN
        UPDATE salary_structures
           SET is_active = FALSE,
               effective_to = COALESCE(effective_to, NEW.effective_from - INTERVAL '1 day')
         WHERE user_id = NEW.user_id
           AND id <> NEW.id
           AND is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deactivate_prev_salary ON salary_structures;
CREATE TRIGGER trg_deactivate_prev_salary
    BEFORE INSERT ON salary_structures
    FOR EACH ROW EXECUTE FUNCTION deactivate_previous_salary_structure();


-- ---------------------------------------------------------------------
-- 7. Helper function: weekly attendance summary for one employee
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_weekly_attendance(p_user_id UUID, p_week_start DATE)
RETURNS TABLE (
    attendance_date DATE,
    status attendance_status,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    worked_hours NUMERIC
) AS $$
    SELECT a.attendance_date, a.status, a.check_in_time, a.check_out_time, a.worked_hours
    FROM attendance a
    WHERE a.user_id = p_user_id
      AND a.attendance_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 day')::date
    ORDER BY a.attendance_date;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------
-- 8. Helper function: remaining leave balance lookup
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_leave_balance(p_user_id UUID, p_leave_type leave_type_enum, p_year INTEGER)
RETURNS NUMERIC AS $$
    SELECT COALESCE(remaining, 0)
    FROM leave_balances
    WHERE user_id = p_user_id AND leave_type = p_leave_type AND year = p_year;
$$ LANGUAGE sql STABLE;
