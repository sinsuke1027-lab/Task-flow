-- TaskFlow RLS policy refinement
-- Replaces the FOR ALL tenant_isolation policies from 001_initial_schema.sql
-- with explicit per-operation policies. audit_logs has no UPDATE/DELETE policy
-- to make audit records immutable.

-- ─── departments ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation ON departments;

CREATE POLICY "departments_select" ON departments
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "departments_insert" ON departments
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "departments_update" ON departments
  FOR UPDATE USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "departments_delete" ON departments
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ─── statuses ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation ON statuses;

CREATE POLICY "statuses_select" ON statuses
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "statuses_insert" ON statuses
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "statuses_update" ON statuses
  FOR UPDATE USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "statuses_delete" ON statuses
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ─── organization_units ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation ON organization_units;

CREATE POLICY "organization_units_select" ON organization_units
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "organization_units_insert" ON organization_units
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "organization_units_update" ON organization_units
  FOR UPDATE USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "organization_units_delete" ON organization_units
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ─── users ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation ON users;

CREATE POLICY "users_select" ON users
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "users_delete" ON users
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ─── categories ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation ON categories;

CREATE POLICY "categories_select" ON categories
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "categories_insert" ON categories
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "categories_update" ON categories
  FOR UPDATE USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "categories_delete" ON categories
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ─── tasks ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation ON tasks;

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ─── audit_logs ──────────────────────────────────────────────────────────────
-- SELECT and INSERT only. No UPDATE or DELETE — audit records are immutable.

DROP POLICY IF EXISTS tenant_isolation ON audit_logs;

CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());

-- ─── user_change_events ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation ON user_change_events;

CREATE POLICY "user_change_events_select" ON user_change_events
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "user_change_events_insert" ON user_change_events
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "user_change_events_update" ON user_change_events
  FOR UPDATE USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "user_change_events_delete" ON user_change_events
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ─── delegations ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation ON delegations;

CREATE POLICY "delegations_select" ON delegations
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "delegations_insert" ON delegations
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "delegations_update" ON delegations
  FOR UPDATE USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "delegations_delete" ON delegations
  FOR DELETE USING (tenant_id = auth_tenant_id());
