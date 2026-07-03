-- ============================================================
-- 004_rls_admin.sql
-- Upgrades RLS on all core tables.
-- ALL table-existence checks are done inside DO blocks so
-- the script never errors on missing tables.
-- Run AFTER 001_platform_admin.sql and 003_pending_invites.sql
-- ============================================================

-- ── USER_PROFILES ─────────────────────────────────────────────

DROP POLICY IF EXISTS "users can view org profiles"    ON public.user_profiles;
DROP POLICY IF EXISTS "users can view profiles"        ON public.user_profiles;
DROP POLICY IF EXISTS "admins can insert profiles"     ON public.user_profiles;
DROP POLICY IF EXISTS "users can update own profile"   ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select"           ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert"           ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update"           ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete"           ON public.user_profiles;

CREATE POLICY "user_profiles_select"
  ON public.user_profiles FOR SELECT
  USING (
    public.is_platform_admin()
    OR organization_id = public.my_org_id()
  );

CREATE POLICY "user_profiles_insert"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (
      organization_id = public.my_org_id()
      AND public.is_org_admin()
    )
  );

CREATE POLICY "user_profiles_update"
  ON public.user_profiles FOR UPDATE
  USING (
    public.is_platform_admin()
    OR auth_user_id = auth.uid()
    OR (
      organization_id = public.my_org_id()
      AND public.is_org_admin()
    )
  );

CREATE POLICY "user_profiles_delete"
  ON public.user_profiles FOR DELETE
  USING (public.is_platform_admin());

-- ── ORGANIZATIONS ─────────────────────────────────────────────

DROP POLICY IF EXISTS "organizations_select"            ON public.organizations;
DROP POLICY IF EXISTS "organizations_update"            ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert"            ON public.organizations;
DROP POLICY IF EXISTS "org members can view their org"  ON public.organizations;

CREATE POLICY "organizations_select"
  ON public.organizations FOR SELECT
  USING (
    public.is_platform_admin()
    OR id = public.my_org_id()
  );

CREATE POLICY "organizations_update"
  ON public.organizations FOR UPDATE
  USING (
    public.is_platform_admin()
    OR (id = public.my_org_id() AND public.is_org_admin())
  );

-- ── PROJECTS ──────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    DROP POLICY IF EXISTS "projects_select"               ON public.projects;
    DROP POLICY IF EXISTS "projects_insert"               ON public.projects;
    DROP POLICY IF EXISTS "projects_update"               ON public.projects;
    DROP POLICY IF EXISTS "projects_delete"               ON public.projects;
    DROP POLICY IF EXISTS "org members can view projects" ON public.projects;
    DROP POLICY IF EXISTS "managers can create projects"  ON public.projects;
    DROP POLICY IF EXISTS "managers can update projects"  ON public.projects;

    CREATE POLICY "projects_select"
      ON public.projects FOR SELECT
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "projects_insert"
      ON public.projects FOR INSERT
      WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "projects_update"
      ON public.projects FOR UPDATE
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "projects_delete"
      ON public.projects FOR DELETE
      USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));
  END IF;
END
$$;

-- ── SPOOLS ────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spools'
  ) THEN
    DROP POLICY IF EXISTS "spools_select"                 ON public.spools;
    DROP POLICY IF EXISTS "spools_insert"                 ON public.spools;
    DROP POLICY IF EXISTS "spools_update"                 ON public.spools;
    DROP POLICY IF EXISTS "spools_delete"                 ON public.spools;
    DROP POLICY IF EXISTS "org members can view spools"   ON public.spools;
    DROP POLICY IF EXISTS "org members can create spools" ON public.spools;
    DROP POLICY IF EXISTS "org members can update spools" ON public.spools;

    CREATE POLICY "spools_select"
      ON public.spools FOR SELECT
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "spools_insert"
      ON public.spools FOR INSERT
      WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "spools_update"
      ON public.spools FOR UPDATE
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "spools_delete"
      ON public.spools FOR DELETE
      USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));
  END IF;
END
$$;

-- ── WELDS (handles both "welds" and "weld_logs" table names) ──

DO $$
BEGIN
  -- Try "welds" table
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'welds'
  ) THEN
    DROP POLICY IF EXISTS "welds_select"                 ON public.welds;
    DROP POLICY IF EXISTS "welds_insert"                 ON public.welds;
    DROP POLICY IF EXISTS "welds_update"                 ON public.welds;
    DROP POLICY IF EXISTS "welds_delete"                 ON public.welds;
    DROP POLICY IF EXISTS "org members can view welds"   ON public.welds;
    DROP POLICY IF EXISTS "org members can create welds" ON public.welds;
    DROP POLICY IF EXISTS "org members can update welds" ON public.welds;

    CREATE POLICY "welds_select"
      ON public.welds FOR SELECT
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "welds_insert"
      ON public.welds FOR INSERT
      WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "welds_update"
      ON public.welds FOR UPDATE
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "welds_delete"
      ON public.welds FOR DELETE
      USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));
  END IF;

  -- Try "weld_logs" table (alternate name)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'weld_logs'
  ) THEN
    DROP POLICY IF EXISTS "welds_select"                 ON public.weld_logs;
    DROP POLICY IF EXISTS "welds_insert"                 ON public.weld_logs;
    DROP POLICY IF EXISTS "welds_update"                 ON public.weld_logs;
    DROP POLICY IF EXISTS "welds_delete"                 ON public.weld_logs;
    DROP POLICY IF EXISTS "org members can view welds"   ON public.weld_logs;
    DROP POLICY IF EXISTS "org members can create welds" ON public.weld_logs;
    DROP POLICY IF EXISTS "org members can update welds" ON public.weld_logs;

    CREATE POLICY "welds_select"
      ON public.weld_logs FOR SELECT
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "welds_insert"
      ON public.weld_logs FOR INSERT
      WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "welds_update"
      ON public.weld_logs FOR UPDATE
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "welds_delete"
      ON public.weld_logs FOR DELETE
      USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));
  END IF;
END
$$;

-- ── WELDERS ───────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'welders'
  ) THEN
    DROP POLICY IF EXISTS "welders_select" ON public.welders;
    DROP POLICY IF EXISTS "welders_insert" ON public.welders;
    DROP POLICY IF EXISTS "welders_update" ON public.welders;
    DROP POLICY IF EXISTS "welders_delete" ON public.welders;

    CREATE POLICY "welders_select"
      ON public.welders FOR SELECT
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "welders_insert"
      ON public.welders FOR INSERT
      WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "welders_update"
      ON public.welders FOR UPDATE
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());

    CREATE POLICY "welders_delete"
      ON public.welders FOR DELETE
      USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));
  END IF;
END
$$;

-- ── AUDIT_LOGS ────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;

    CREATE POLICY "audit_logs_select"
      ON public.audit_logs FOR SELECT
      USING (public.is_platform_admin() OR organization_id = public.my_org_id());
  END IF;
END
$$;

-- ── Grant service_role access to new tables ───────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pending_invites'
  ) THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.pending_invites TO service_role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_members'
  ) THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.organization_members TO service_role';
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO service_role;
