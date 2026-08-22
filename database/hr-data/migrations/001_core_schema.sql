-- =====================================================================
-- Dayflow HRMS — hr-data module
-- Migration 001: Extensions, Enum Types, Core Identity & Profile Tables
-- Target: PostgreSQL 14+
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'HR', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE employment_type AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE employment_status AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE leave_type_enum AS ENUM ('PAID', 'SICK', 'UNPAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE leave_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('ID_PROOF', 'RESUME', 'OFFER_LETTER', 'CONTRACT', 'CERTIFICATE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('INFO', 'ALERT', 'APPROVAL', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- TABLE: users
-- Authentication + role-based access (FR 3.1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code       VARCHAR(20)  NOT NULL UNIQUE,          -- e.g. EMP-0001, used at sign up
    email               CITEXT       NOT NULL UNIQUE,
    password_hash       TEXT         NOT NULL,                 -- bcrypt/argon2 hash, never plaintext
    role                user_role    NOT NULL DEFAULT 'EMPLOYEE',
    is_email_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,     -- soft-disable instead of hard delete
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT chk_employee_code_format CHECK (employee_code ~ '^[A-Za-z0-9\-]{3,20}$')
);

CREATE INDEX IF NOT EXISTS idx_users_role        ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active   ON users (is_active);

COMMENT ON TABLE users IS 'Auth + RBAC root entity. One row per person who can log in (Employee, HR, Admin).';
COMMENT ON COLUMN users.password_hash IS 'Store only a salted hash (bcrypt/argon2id). Application layer must never persist plaintext.';

-- ---------------------------------------------------------------------
-- TABLE: employee_profiles  (1:1 with users)
-- Personal details (FR 3.3.1 / 3.3.2)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_profiles (
    user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    phone                   VARCHAR(20),
    address                 TEXT,
    date_of_birth           DATE,
    gender                  VARCHAR(20),
    profile_picture_url     TEXT,
    emergency_contact_name  VARCHAR(150),
    emergency_contact_phone VARCHAR(20),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE employee_profiles IS
  'Editable-by-employee personal fields (address/phone/photo). Admin can edit all fields via app-layer authorization.';

-- ---------------------------------------------------------------------
-- TABLE: job_details  (1:1 with users)
-- Job/organizational details, editable by Admin only
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_details (
    user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    department            VARCHAR(100) NOT NULL,
    designation            VARCHAR(100) NOT NULL,
    employment_type        employment_type NOT NULL DEFAULT 'FULL_TIME',
    date_of_joining         DATE NOT NULL,
    reporting_manager_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    employment_status       employment_status NOT NULL DEFAULT 'ACTIVE',
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_not_own_manager CHECK (reporting_manager_id IS DISTINCT FROM user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_details_department ON job_details (department);
CREATE INDEX IF NOT EXISTS idx_job_details_manager     ON job_details (reporting_manager_id);

-- ---------------------------------------------------------------------
-- TABLE: documents
-- Employee documents (FR 3.3.1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type     document_type NOT NULL,
    file_name    VARCHAR(255) NOT NULL,
    file_url     TEXT NOT NULL,
    uploaded_by  UUID REFERENCES users(id) ON DELETE SET NULL,  -- self or admin
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type    ON documents (doc_type);
