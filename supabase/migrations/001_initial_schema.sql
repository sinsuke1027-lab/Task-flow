-- TaskFlow initial schema
-- Multi-tenant PostgreSQL schema for Supabase
--
-- Column naming follows TypeScript interface field names (camelCase quoted identifiers)
-- to keep SupabaseDataProvider queries consistent with src/lib/repository/types.ts.
-- tenant_id uses snake_case as it is the RLS partition key.

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE departments (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id   UUID NOT NULL,
  name        TEXT NOT NULL
);

CREATE TABLE statuses (
  id          TEXT PRIMARY KEY,
  tenant_id   UUID NOT NULL,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL
);

CREATE TABLE organization_units (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id   UUID NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('division', 'group', 'team', 'root')),
  "parentId"  TEXT REFERENCES organization_units(id),
  status      TEXT NOT NULL CHECK (status IN ('active', 'archived'))
);

CREATE TABLE users (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id        UUID NOT NULL,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  "departmentId"   TEXT NOT NULL REFERENCES departments(id),
  "orgUnitId"      TEXT NOT NULL REFERENCES organization_units(id),
  "managerId"      TEXT REFERENCES users(id),
  position         TEXT NOT NULL,
  avatar           TEXT,
  status           TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'on_leave')),
  "joinedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "leftAt"         TIMESTAMPTZ
);

CREATE TABLE categories (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id             UUID NOT NULL,
  name                  TEXT NOT NULL,
  "parentId"            TEXT REFERENCES categories(id),
  "targetDepartmentId"  TEXT NOT NULL REFERENCES departments(id),
  "slaDays"             INTEGER,
  "customFields"        JSONB NOT NULL DEFAULT '[]',
  "workflowTemplate"    JSONB NOT NULL DEFAULT '[]',
  "amountRules"         JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE tasks (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id             UUID NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  "requesterId"         TEXT NOT NULL REFERENCES users(id),
  "targetDepartmentId"  TEXT NOT NULL REFERENCES departments(id),
  "categoryId"          TEXT NOT NULL REFERENCES categories(id),
  category              TEXT,
  "statusId"            TEXT NOT NULL REFERENCES statuses(id),
  status                TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'completed')),
  priority              TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high')) DEFAULT 'normal',
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "dueDate"             TIMESTAMPTZ NOT NULL,
  "approvalRoute"       JSONB NOT NULL DEFAULT '[]',
  "ccRoute"             JSONB DEFAULT '[]',
  "currentApproverId"   TEXT REFERENCES users(id),
  "currentApproverName" TEXT,
  "customData"          JSONB DEFAULT '{}',
  "taskType"            TEXT CHECK ("taskType" IN ('approval', 'circulation')) DEFAULT 'approval'
);

CREATE TABLE audit_logs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id   UUID NOT NULL,
  "taskId"    TEXT NOT NULL REFERENCES tasks(id),
  "userId"    TEXT NOT NULL REFERENCES users(id),
  "userName"  TEXT,
  action      TEXT NOT NULL,
  comment     TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_change_events (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id     UUID NOT NULL,
  "targetType"  TEXT NOT NULL CHECK ("targetType" IN ('user', 'unit')),
  "targetId"    TEXT NOT NULL,
  "eventType"   TEXT NOT NULL CHECK ("eventType" IN (
                  'join', 'transfer', 'promotion', 'leave', 'retire',
                  'unit_create', 'unit_update', 'unit_archive'
                )),
  "scheduledAt" TIMESTAMPTZ NOT NULL,
  "appliedAt"   TIMESTAMPTZ,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'cancelled')) DEFAULT 'pending',
  changes       JSONB NOT NULL DEFAULT '{}',
  note          TEXT
);

CREATE TABLE delegations (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id     UUID NOT NULL,
  "delegatorId" TEXT NOT NULL REFERENCES users(id),
  "delegateId"  TEXT NOT NULL REFERENCES users(id),
  "startDate"   TIMESTAMPTZ NOT NULL,
  "endDate"     TIMESTAMPTZ,
  reason        TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegations        ENABLE ROW LEVEL SECURITY;

-- Helper: read tenant_id from the authenticated user's JWT metadata
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
$$;

-- Tenant isolation: each row is visible and writable only within its tenant
CREATE POLICY tenant_isolation ON departments
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY tenant_isolation ON statuses
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY tenant_isolation ON organization_units
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY tenant_isolation ON users
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY tenant_isolation ON categories
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY tenant_isolation ON tasks
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY tenant_isolation ON audit_logs
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY tenant_isolation ON user_change_events
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY tenant_isolation ON delegations
  FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX ON tasks              (tenant_id, "statusId");
CREATE INDEX ON tasks              (tenant_id, "requesterId");
CREATE INDEX ON tasks              (tenant_id, "currentApproverId");
CREATE INDEX ON tasks              (tenant_id, "createdAt" DESC);
CREATE INDEX ON audit_logs         (tenant_id, "taskId");
CREATE INDEX ON users              (tenant_id, email);
CREATE INDEX ON user_change_events (tenant_id, status, "scheduledAt");
CREATE INDEX ON delegations        (tenant_id, "delegatorId", "isActive");
