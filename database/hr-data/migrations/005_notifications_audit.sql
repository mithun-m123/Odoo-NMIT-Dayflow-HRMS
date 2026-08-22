-- =====================================================================
-- Migration 005: Notifications & Audit Logging
-- (Supports "Email & notification alerts" in section 4 of the SRS)
-- =====================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- recipient
    title               VARCHAR(150) NOT NULL,
    message             TEXT NOT NULL,
    type                notification_type NOT NULL DEFAULT 'INFO',
    related_entity_type VARCHAR(50),   -- e.g. 'LEAVE_REQUEST', 'ATTENDANCE', 'SALARY_SLIP'
    related_entity_id   UUID,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications (related_entity_type, related_entity_id);

-- ---------------------------------------------------------------------
-- TABLE: audit_logs
-- Generic change-history table for sensitive edits (salary, role changes)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name    VARCHAR(100) NOT NULL,
    record_id     UUID NOT NULL,
    action        VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    performed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    old_data      JSONB,
    new_data      JSONB,
    performed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by  ON audit_logs (performed_by);
