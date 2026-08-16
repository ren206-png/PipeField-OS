-- ============================================================
-- Migration: 20260815_turnover_packages_v2
-- Extend turnover_packages with PDF-specific metadata columns.
-- Also adds the turnover-packages Storage bucket setup note.
--
-- ACTION REQUIRED in Supabase Dashboard before deploying:
--   Storage → New Bucket → Name: turnover-packages
--   Public: OFF (private)
-- Then run this migration.
-- ============================================================

ALTER TABLE public.turnover_packages
  ADD COLUMN IF NOT EXISTS document_sha256 TEXT,
    -- SHA-256 of the generated PDF bytes (set at generation time)
  ADD COLUMN IF NOT EXISTS page_count      INTEGER,
    -- PDF page count (informational; set when PDF is generated)
  ADD COLUMN IF NOT EXISTS weld_count      INTEGER,
    -- Snapshot of weld count at generation time
  ADD COLUMN IF NOT EXISTS nde_count       INTEGER,
    -- Snapshot of NDE record count
  ADD COLUMN IF NOT EXISTS mtr_count       INTEGER,
    -- Snapshot of MTR count
  ADD COLUMN IF NOT EXISTS test_count      INTEGER;
    -- Snapshot of pressure test count

COMMENT ON COLUMN public.turnover_packages.storage_path IS
  'Path inside the turnover-packages Storage bucket. '
  'Null if PDF generation failed or storage upload failed. '
  'Use /api/turnover/packages/[id]/download to get a signed URL.';

COMMENT ON COLUMN public.turnover_packages.document_sha256 IS
  'SHA-256 hex digest of the generated PDF bytes. '
  'Verify on download to detect storage corruption.';

-- ── Storage RLS policies for turnover-packages bucket ────────
-- Run these AFTER creating the bucket in the Supabase Dashboard.
-- Org members can read their own packages; no public access.

-- INSERT (upload) — server-side only via service role (no user-facing policy needed)
-- SELECT (download) — org members can read their own bucket objects
INSERT INTO storage.policies (name, bucket_id, definition, check_definition, command)
VALUES (
  'turnover_packages_org_read',
  'turnover-packages',
  '(SELECT organization_id FROM public.turnover_packages WHERE storage_path = name LIMIT 1) IN (SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid())',
  NULL,
  'SELECT'
) ON CONFLICT DO NOTHING;
