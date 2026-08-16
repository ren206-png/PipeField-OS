-- ============================================================
-- Migration: 20260815_project_standards_config
-- Add international standards configuration to projects table.
--
-- New columns:
--   governing_code       — human-readable standard + edition
--                          e.g. 'ASME B31.3-2022'
--   governing_code_year  — edition year as integer for comparisons
--   jurisdiction         — ISO 3166 country/subdivision
--                          e.g. 'US-TX', 'CA-AB', 'GB', 'AU'
--   unit_system          — 'imperial' | 'si' | 'mixed'
--   locale               — BCP-47 locale code
--                          e.g. 'en-US', 'fr-CA', 'en-GB'
--   ahj                  — Authority Having Jurisdiction (free text)
--   page_size            — PDF page size: 'letter' | 'A4'
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS governing_code       TEXT,
  ADD COLUMN IF NOT EXISTS governing_code_year  INTEGER,
  ADD COLUMN IF NOT EXISTS jurisdiction         TEXT,
  ADD COLUMN IF NOT EXISTS unit_system          TEXT
    DEFAULT 'imperial'
    CHECK (unit_system IN ('imperial', 'si', 'mixed')),
  ADD COLUMN IF NOT EXISTS locale               TEXT
    DEFAULT 'en-US',
  ADD COLUMN IF NOT EXISTS ahj                  TEXT,
  ADD COLUMN IF NOT EXISTS page_size            TEXT
    DEFAULT 'letter'
    CHECK (page_size IN ('letter', 'A4'));

COMMENT ON COLUMN public.projects.governing_code      IS 'Primary design code + edition, e.g. ASME B31.3-2022';
COMMENT ON COLUMN public.projects.governing_code_year IS 'Edition year extracted for range comparisons';
COMMENT ON COLUMN public.projects.jurisdiction        IS 'ISO 3166-2 subdivision or country, e.g. US-TX, CA-AB, GB';
COMMENT ON COLUMN public.projects.unit_system         IS 'Unit system used for this project: imperial | si | mixed';
COMMENT ON COLUMN public.projects.locale              IS 'BCP-47 locale for date/number formatting, e.g. en-US, fr-CA';
COMMENT ON COLUMN public.projects.ahj                 IS 'Authority Having Jurisdiction (free text)';
COMMENT ON COLUMN public.projects.page_size           IS 'PDF page size for reports and turnover packages';
