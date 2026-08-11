-- ============================================================
-- 20260805_enable_rls_core_tables.sql
--
-- SECURITY: Enable Row Level Security on core tables that
-- were missing ENABLE ROW LEVEL SECURITY despite having
-- policies defined. Also adds missing INSERT/UPDATE policies.
--
-- Run this migration BEFORE deploying any code that removes
-- the admin client from server-side detail page renders.
--
-- Safe to re-run (idempotent — uses IF NOT EXISTS where possible
-- and DROP POLICY IF EXISTS before CREATE POLICY).
-- ============================================================

-- ── 1. Enable RLS on tables missing it ───────────────────────
-- Policies existed but were not being enforced without this.

ALTER TABLE public.projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ── 2. audit_logs: add missing INSERT policy ─────────────────
-- Without this, client-side audit writes (weld status changes,
-- spool updates) silently failed when RLS is enabled.

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;

CREATE POLICY "audit_logs_insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR organization_id = public.my_org_id()
  );

-- ── 3. weld_photos: add missing UPDATE policy ────────────────
-- Caption edits and metadata updates were silently failing.

DROP POLICY IF EXISTS "weld_photos_update" ON public.weld_photos;

CREATE POLICY "weld_photos_update"
  ON public.weld_photos FOR UPDATE
  USING (
    public.is_platform_admin()
    OR organization_id = public.my_org_id()
  )
  WITH CHECK (
    public.is_platform_admin()
    OR organization_id = public.my_org_id()
  );

-- ── 4. Storage: tighten weld-photos bucket policies ──────────
-- The bucket was set to public=true and policies allowed any
-- authenticated user from any org to view any photo.
-- This scopes upload paths and restricts access.
--
-- NOTE: After running this migration you must also update the
-- bucket's `public` setting to false in the Supabase dashboard
-- (Storage → weld-photos → Edit bucket → uncheck Public bucket)
-- OR run: UPDATE storage.buckets SET public = false WHERE id = 'weld-photos';

UPDATE storage.buckets
  SET public = false
  WHERE id = 'weld-photos';

-- Drop old permissive storage policies
DROP POLICY IF EXISTS "org_members_upload_weld_photos" ON storage.objects;
DROP POLICY IF EXISTS "org_members_view_weld_photos"   ON storage.objects;
DROP POLICY IF EXISTS "uploaders_delete_weld_photos"   ON storage.objects;

-- New: upload is scoped so the first path segment must be the org's id.
-- Photo storage paths should follow: {organization_id}/{weld_id}/{filename}
CREATE POLICY "org_members_upload_weld_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'weld-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- New: view is scoped to the same org prefix
CREATE POLICY "org_members_view_weld_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'weld-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- New: delete is scoped to same org prefix
CREATE POLICY "uploaders_delete_weld_photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'weld-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- ── 5. Verification queries (run manually after migration) ───
-- Check RLS is enabled on all six audited tables:
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename IN ('projects','spools','spool_items','welds','weld_photos','audit_logs');
--   Expected: rowsecurity = true for all six rows.
--
-- Check audit_logs policies:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'audit_logs';
--   Expected: audit_logs_select (SELECT) + audit_logs_insert (INSERT)
--
-- Check weld-photos bucket is private:
--   SELECT id, name, public FROM storage.buckets WHERE id = 'weld-photos';
--   Expected: public = false
