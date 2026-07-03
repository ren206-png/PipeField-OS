-- Add completed_at to itps table for auto-completion tracking
ALTER TABLE public.itps
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.itps.completed_at IS
  'Set automatically when every itp_items row for this ITP is complete or not_applicable.';
