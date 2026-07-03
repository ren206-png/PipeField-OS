-- ============================================================
-- Add ALL missing columns to welds + spools
-- Run once in Supabase Dashboard → SQL Editor
-- ============================================================

-- Welds: extra tracking columns
ALTER TABLE public.welds
  ADD COLUMN IF NOT EXISTS spool_number   TEXT,
  ADD COLUMN IF NOT EXISTS line_number    TEXT,
  ADD COLUMN IF NOT EXISTS pipe_size      TEXT,
  ADD COLUMN IF NOT EXISTS wall_thickness TEXT,
  ADD COLUMN IF NOT EXISTS weld_process   TEXT;

-- Spools: full spec columns
ALTER TABLE public.spools
  ADD COLUMN IF NOT EXISTS revision         TEXT DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS pipe_size        TEXT,
  ADD COLUMN IF NOT EXISTS pipe_schedule    TEXT,
  ADD COLUMN IF NOT EXISTS material         TEXT,
  ADD COLUMN IF NOT EXISTS service          TEXT,
  ADD COLUMN IF NOT EXISTS design_pressure  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS design_temp      NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS total_welds      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_length_in  NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS isometric_ref    TEXT,
  ADD COLUMN IF NOT EXISTS area             TEXT,
  ADD COLUMN IF NOT EXISTS priority         INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS required_date    DATE,
  ADD COLUMN IF NOT EXISTS released_date    DATE,
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES public.user_profiles(id);

-- Fix spool status constraint
ALTER TABLE public.spools DROP CONSTRAINT IF EXISTS spools_status_check;
ALTER TABLE public.spools ADD CONSTRAINT spools_status_check
  CHECK (status IN ('designed','material_released','cut','fit_up','welded','nde','painted','released'));

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
