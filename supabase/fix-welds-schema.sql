-- ============================================================
-- Fix welds table — add missing columns
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.welds
  ADD COLUMN IF NOT EXISTS spool_number   TEXT,
  ADD COLUMN IF NOT EXISTS line_number    TEXT,
  ADD COLUMN IF NOT EXISTS pipe_size      TEXT,
  ADD COLUMN IF NOT EXISTS wall_thickness TEXT,
  ADD COLUMN IF NOT EXISTS weld_process   TEXT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
