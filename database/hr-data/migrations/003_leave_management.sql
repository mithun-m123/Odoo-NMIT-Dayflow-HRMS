-- =====================================================================
-- Migration 003: Leave & Time-Off Management (FR 3.5)
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABLE: leave_balances
-- Yearly quota per employee per leave type. Seeded by HR/Admin.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_balances (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type       leave_type_enum NOT NULL,
    year             INTEGER NOT NULL,
    total_allocated  NUMERIC(5,1) NOT NULL DEFAULT 0,
    used             NUMERIC(5,1) NOT NULL DEFAULT 0,
    remaining        NUMERIC(5,1) GENERATED ALWAYS AS (total_allocated - used) STORED,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_leave_balance UNIQUE (user_id, leave_type, year),
    CONSTRAINT chk_used_nonnegative CHECK (used >= 0)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON leave_balances (user_id, year);

-- ---------------------------------------------------------------------
-- TABLE: leave_requests  (FR 3.5.1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type   leave_type_enum NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    total_days   NUMERIC(5,1) GENERATED ALWAYS AS ((end_date - start_date) + 1) STORED,
    remarks      TEXT,
    status       leave_status NOT NULL DEFAULT 'PENDING',
    applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_leave_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id  ON leave_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status   ON leave_requests (status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_daterange ON leave_requests (user_id, start_date, end_date);

COMMENT ON TABLE leave_requests IS
  'Employee-submitted leave applications. Overlap prevention + balance deduction handled in 004_business_logic.sql triggers.';

-- ---------------------------------------------------------------------
-- TABLE: leave_approval_logs  (FR 3.5.2)
-- Full audit trail of Admin/HR decisions (a request may be revisited).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_approval_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id  UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    approver_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision          leave_status NOT NULL,   -- APPROVED / REJECTED / CANCELLED
    comments          TEXT,
    decided_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_decision_value CHECK (decision IN ('APPROVED', 'REJECTED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_leave_approval_logs_request ON leave_approval_logs (leave_request_id);
