-- =====================================================================
-- Migration 002: Attendance Tracking (FR 3.4)
-- =====================================================================

CREATE TABLE IF NOT EXISTS attendance (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date  DATE NOT NULL,
    check_in_time    TIMESTAMPTZ,
    check_out_time   TIMESTAMPTZ,
    status           attendance_status NOT NULL DEFAULT 'ABSENT',
    -- Generated column: worked hours, computed only when both timestamps exist
    worked_hours     NUMERIC(5,2) GENERATED ALWAYS AS (
                        CASE
                          WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL
                          THEN ROUND(EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0, 2)
                          ELSE NULL
                        END
                     ) STORED,
    remarks          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One attendance record per employee per calendar day
    CONSTRAINT uq_attendance_user_date UNIQUE (user_id, attendance_date),

    -- Business rule: check-out must be strictly after check-in (also enforced via trigger for a friendlier error)
    CONSTRAINT chk_checkout_after_checkin CHECK (
        check_out_time IS NULL OR check_in_time IS NULL OR check_out_time > check_in_time
    )
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance (user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status      ON attendance (status);

COMMENT ON TABLE attendance IS
  'Daily attendance ledger. worked_hours is derived, never written directly by the app.';
COMMENT ON COLUMN attendance.status IS
  'Present/Absent/Half-day/Leave, per FR 3.4.1. Auto-suggested by trigger, can be overridden by HR.';
