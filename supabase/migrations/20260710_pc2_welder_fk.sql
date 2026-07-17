-- PC-2: Add welder_id FK to welds table
-- Keeps welder_stamp (human-readable display) but adds FK for enforcement

ALTER TABLE public.welds
  ADD COLUMN IF NOT EXISTS welder_id UUID REFERENCES public.welders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_welds_welder_id ON public.welds(welder_id);
CREATE INDEX IF NOT EXISTS idx_welds_welder_status ON public.welds(welder_id, status) WHERE welder_id IS NOT NULL;

-- Backfill: match stamp → welders table where stamps align
-- (Safe to run even if some don't match — nulls are acceptable)
DO $$
BEGIN
  UPDATE public.welds w
  SET welder_id = wl.id
  FROM public.welders wl
  WHERE wl.organization_id = w.organization_id
    AND wl.stamp = w.welder_stamp
    AND w.welder_id IS NULL;
EXCEPTION WHEN OTHERS THEN
  -- welders.stamp column may not exist yet — safe to skip backfill
  RAISE NOTICE 'Backfill skipped: %', SQLERRM;
END $$;
