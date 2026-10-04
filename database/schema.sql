-- ==========================================================================
-- Horizon — PostgreSQL schema
--
-- Safe to run more than once: every statement uses IF NOT EXISTS.
-- Run it with either:
--     npm run db:init                       (uses DATABASE_URL from .env)
--     psql "$DATABASE_URL" -f database/schema.sql
-- ==========================================================================

-- gen_random_uuid() is built in on PostgreSQL 13+. On older versions it comes
-- from pgcrypto. If this line errors on PostgreSQL 13+, you can ignore it.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------------------------------------------------------------------------
-- users
-- Emails are stored lowercase (the API normalises them; the CHECK enforces it).
-- Only the bcrypt hash is stored, never the password.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_email_lowercase CHECK (email = LOWER(email))
);

-- --------------------------------------------------------------------------
-- tasks
-- Every task belongs to exactly one user. Deleting a user deletes their tasks.
-- priority/category are restricted at the database level too, so bad data
-- cannot get in even if an API bug slips through.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id      UUID NOT NULL,

    title        VARCHAR(120) NOT NULL,
    description  VARCHAR(500),

    due_date     DATE,

    priority     VARCHAR(20) NOT NULL DEFAULT 'medium',
    category     VARCHAR(30) NOT NULL,

    completed    BOOLEAN NOT NULL DEFAULT FALSE,

    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tasks_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT tasks_title_not_blank CHECK (char_length(btrim(title)) > 0),

    CONSTRAINT tasks_priority_valid
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),

    CONSTRAINT tasks_category_valid
        CHECK (category IN ('today', 'tomorrow', 'thisWeek', 'nextWeek',
                            'thisMonth', 'nextMonth', 'thisYear', 'longTerm'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id    ON tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date   ON tasks (due_date);

-- --------------------------------------------------------------------------
-- session
-- Server-side login sessions, used by connect-pg-simple (the table name and
-- columns must match what that library expects). The browser only ever holds
-- an opaque, signed session id in an HTTP-only cookie.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "session" (
    "sid"    VARCHAR      NOT NULL PRIMARY KEY,
    "sess"   JSON         NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
