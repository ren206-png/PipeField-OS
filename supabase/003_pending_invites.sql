-- ============================================================
-- 003_pending_invites.sql
-- pending_invites — stores email invitations sent by org admins.
-- Token is a UUID used in the signup link.
-- When the invited user signs up, /api/register matches their
-- email + token, assigns the org/role, marks invite accepted.
--
-- Run AFTER 002_org_members.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pending_invites (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'pipefitter'
                    CHECK (role IN (
                      'organization_owner','administrator','project_manager',
                      'foreman','qa_inspector','shop_fabricator','pipefitter','client_viewer'
                    )),
  invited_by      uuid NOT NULL REFERENCES auth.users(id),
  token           uuid NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','expired','cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pending_invites_email  ON public.pending_invites(email);
CREATE INDEX IF NOT EXISTS idx_pending_invites_token  ON public.pending_invites(token);
CREATE INDEX IF NOT EXISTS idx_pending_invites_org_id ON public.pending_invites(organization_id);

-- ── Enable RLS ────────────────────────────────────────────────
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────

-- SELECT: org admins see invites for their org; platform_admin sees all
-- The /api/register route uses the service role key (bypasses RLS) to
-- look up a token by email — so anon token lookup is NOT needed here.
CREATE POLICY "pending_invites_select"
  ON public.pending_invites
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR (
      organization_id = public.my_org_id()
      AND public.is_org_admin()
    )
  );

-- INSERT: org admins can create invites for their org
CREATE POLICY "pending_invites_insert"
  ON public.pending_invites
  FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (
      organization_id = public.my_org_id()
      AND public.is_org_admin()
    )
  );

-- UPDATE: org admins can cancel/expire invites; register route uses service role
CREATE POLICY "pending_invites_update"
  ON public.pending_invites
  FOR UPDATE
  USING (
    public.is_platform_admin()
    OR (
      organization_id = public.my_org_id()
      AND public.is_org_admin()
    )
  );

-- DELETE: org admins can delete pending invites from their org
CREATE POLICY "pending_invites_delete"
  ON public.pending_invites
  FOR DELETE
  USING (
    public.is_platform_admin()
    OR (
      organization_id = public.my_org_id()
      AND public.is_org_admin()
    )
  );

-- ── Helper: expire old invites (run as a cron or manually) ──
CREATE OR REPLACE FUNCTION public.expire_old_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.pending_invites
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < now();
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;
