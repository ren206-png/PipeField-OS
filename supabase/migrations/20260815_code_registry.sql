-- ============================================================
-- Migration: 20260815_code_registry
-- Global lookup table of known design codes and editions.
-- Used to validate projects.governing_code and to drive
-- the code selector in project settings.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.code_registry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard    TEXT NOT NULL,        -- e.g. 'ASME B31.3'
  edition     TEXT NOT NULL,        -- e.g. '2022'
  label       TEXT NOT NULL,        -- e.g. 'ASME B31.3-2022 Process Piping'
  regions     TEXT[],               -- NULL = global; ARRAY['US','CA'] = region-specific
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (standard, edition)
);

COMMENT ON TABLE public.code_registry IS
  'Registry of known design codes and edition years. '
  'Drives the governing_code selector in project settings. '
  'Can be extended per-deployment without schema changes.';

-- Enable RLS — read-only for all authenticated users; no row-level write policy
-- (writes are handled by DB admin / seed data).
ALTER TABLE public.code_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "code_registry_read_all" ON public.code_registry
  FOR SELECT TO authenticated USING (true);

-- ── Seed data ──────────────────────────────────────────────
INSERT INTO public.code_registry (standard, edition, label, regions) VALUES
  -- Process piping
  ('ASME B31.3', '2022', 'ASME B31.3-2022 Process Piping',           NULL),
  ('ASME B31.3', '2020', 'ASME B31.3-2020 Process Piping',           NULL),
  ('ASME B31.3', '2018', 'ASME B31.3-2018 Process Piping',           NULL),
  -- Power piping
  ('ASME B31.1', '2022', 'ASME B31.1-2022 Power Piping',             NULL),
  ('ASME B31.1', '2020', 'ASME B31.1-2020 Power Piping',             NULL),
  -- Gas distribution
  ('ASME B31.8', '2022', 'ASME B31.8-2022 Gas Transmission & Distribution', NULL),
  -- Pipeline
  ('ASME B31.4', '2022', 'ASME B31.4-2022 Pipeline Transportation Systems', NULL),
  -- Canadian
  ('CSA Z662',   '23',   'CSA Z662-23 Oil and Gas Pipeline Systems', ARRAY['CA']),
  ('CSA Z662',   '19',   'CSA Z662-19 Oil and Gas Pipeline Systems', ARRAY['CA']),
  -- European
  ('EN 13480',   '2017', 'EN 13480-2017 Metallic Industrial Piping', ARRAY['GB', 'EU']),
  ('EN 13480',   '2012', 'EN 13480-2012 Metallic Industrial Piping', ARRAY['GB', 'EU']),
  -- Australian
  ('AS 4041',    '2006', 'AS 4041-2006 Pressure Piping',             ARRAY['AU']),
  -- Pipe dimensions
  ('ASME B36.10M','2018','ASME B36.10M-2018 Welded and Seamless Wrought Steel Pipe', NULL),
  ('ASME B36.10M','2015','ASME B36.10M-2015 Welded and Seamless Wrought Steel Pipe', NULL),
  ('ASME B36.19M','2018','ASME B36.19M-2018 Stainless Steel Pipe',  NULL)
ON CONFLICT (standard, edition) DO NOTHING;
