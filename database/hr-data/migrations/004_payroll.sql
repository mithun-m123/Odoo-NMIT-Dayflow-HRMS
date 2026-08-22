-- =====================================================================
-- Migration 004: Payroll / Salary Management (FR 3.6)
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABLE: salary_structures
-- Versioned salary structure. Only one row per user can be is_active=TRUE.
-- Editable by Admin only; read-only for the employee (enforced app-side).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_structures (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    basic_pay             NUMERIC(12,2) NOT NULL DEFAULT 0,
    hra                   NUMERIC(12,2) NOT NULL DEFAULT 0,
    conveyance_allowance  NUMERIC(12,2) NOT NULL DEFAULT 0,
    medical_allowance     NUMERIC(12,2) NOT NULL DEFAULT 0,
    special_allowance     NUMERIC(12,2) NOT NULL DEFAULT 0,
    gross_salary          NUMERIC(12,2) GENERATED ALWAYS AS (
                              basic_pay + hra + conveyance_allowance + medical_allowance + special_allowance
                           ) STORED,
    tax_deduction         NUMERIC(12,2) NOT NULL DEFAULT 0,
    provident_fund        NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_deductions      NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_deductions      NUMERIC(12,2) GENERATED ALWAYS AS (
                              tax_deduction + provident_fund + other_deductions
                           ) STORED,
    net_salary            NUMERIC(12,2) GENERATED ALWAYS AS (
                              (basic_pay + hra + conveyance_allowance + medical_allowance + special_allowance)
                              - (tax_deduction + provident_fund + other_deductions)
                           ) STORED,
    currency              CHAR(3) NOT NULL DEFAULT 'INR',
    effective_from        DATE NOT NULL,
    effective_to          DATE,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_salary_effective_order CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT chk_salary_nonnegative CHECK (
        basic_pay >= 0 AND hra >= 0 AND conveyance_allowance >= 0 AND
        medical_allowance >= 0 AND special_allowance >= 0 AND
        tax_deduction >= 0 AND provident_fund >= 0 AND other_deductions >= 0
    )
);

-- Only one ACTIVE salary structure per employee at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_salary_per_user
    ON salary_structures (user_id) WHERE (is_active);

CREATE INDEX IF NOT EXISTS idx_salary_structures_user_id ON salary_structures (user_id);

-- ---------------------------------------------------------------------
-- TABLE: salary_slips
-- Generated, immutable monthly payroll output ("reports like salary slips")
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_slips (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salary_structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE RESTRICT,
    pay_month           SMALLINT NOT NULL CHECK (pay_month BETWEEN 1 AND 12),
    pay_year            SMALLINT NOT NULL CHECK (pay_year BETWEEN 2000 AND 2100),
    days_present        NUMERIC(5,1) NOT NULL DEFAULT 0,
    days_on_leave       NUMERIC(5,1) NOT NULL DEFAULT 0,
    gross_salary        NUMERIC(12,2) NOT NULL,
    total_deductions    NUMERIC(12,2) NOT NULL,
    net_salary          NUMERIC(12,2) NOT NULL,
    generated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_salary_slip_month UNIQUE (user_id, pay_month, pay_year)
);

CREATE INDEX IF NOT EXISTS idx_salary_slips_user_period ON salary_slips (user_id, pay_year, pay_month);
