-- ============================================================
-- Migration: 20260815_signature_content_hash
-- Add content hash to signatures table for tamper detection.
-- Add immutable DB triggers to signatures and audit_logs.
--
-- content_hash: SHA-256 of the canonical JSON of the signed
-- record at the moment of signing. Recompute on read and compare
-- to detect post-signature mutations.
-- ============================================================

-- ── Content hash columns ──────────────────────────────────────
ALTER TABLE public.signatures
  ADD COLUMN IF NOT EXISTS content_hash     TEXT,
    -- SHA-256 hex of canonicalized signed document at time of signing
  ADD COLUMN IF NOT EXISTS content_type     TEXT,
    -- e.g. 'weld_record', 'test_package', 'mtr', 'turnover_package'
  ADD COLUMN IF NOT EXISTS content_version  INTEGER DEFAULT 1;
    -- Incremented if the signed object schema changes; used for hash algorithm selection

COMMENT ON COLUMN public.signatures.content_hash IS
  'SHA-256 hex digest of the canonical JSON of the signed record. '
  'Computed client-side before presenting the signature pad. '
  'Re-compute on read and compare to detect post-signature mutation.';

-- ── Immutable trigger: signatures ─────────────────────────────
-- Prevents any UPDATE to a signature row. Amendments must insert a new row.
CREATE OR REPLACE FUNCTION public.prevent_signature_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION
    'signatures are immutable — insert a new row to supersede this signature (id: %)',
    OLD.id
    USING ERRCODE = 'raise_exception';
END;
$$;

DROP TRIGGER IF EXISTS signatures_immutable ON public.signatures;
CREATE TRIGGER signatures_immutable
  BEFORE UPDATE ON public.signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_signature_update();

-- ── Immutable trigger: audit_logs ─────────────────────────────
-- Prevents UPDATE or DELETE on audit_logs.
-- Note: RLS alone is bypassable by service role.
-- This trigger fires even for service role callers.
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'audit_logs rows are immutable and cannot be deleted (id: %)',
      OLD.id
      USING ERRCODE = 'raise_exception';
  ELSE
    RAISE EXCEPTION
      'audit_logs rows are immutable and cannot be updated (id: %)',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();
