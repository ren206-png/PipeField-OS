-- ============================================================
-- Migration: 20260815_welder_qual_essential_vars
-- Add ASME IX essential variable columns to welder_certifications.
-- Also creates position_coverage lookup table for expanded
-- position qualification checks.
--
-- ENGINEERING_REVIEW_REQUIRED: All coverage rules in
-- position_coverage must be verified against ASME IX QW-461.9
-- before enabling PFOS_QUAL_ENFORCEMENT in production.
-- See RULES_REQUIRING_VERIFICATION.md: RULE-001, RULE-002, RULE-003.
-- ============================================================

-- ── Essential variable columns ────────────────────────────────
ALTER TABLE public.welder_certifications
  ADD COLUMN IF NOT EXISTS p_number_base        TEXT,
    -- QW-422 P-Number of base metal tested, e.g. 'P1', 'P8'
  ADD COLUMN IF NOT EXISTS f_number             TEXT,
    -- QW-432 F-Number of filler, e.g. 'F3', 'F6'
  ADD COLUMN IF NOT EXISTS a_number             TEXT,
    -- QW-442 A-Number (weld metal analysis group)
  ADD COLUMN IF NOT EXISTS thickness_min_in     NUMERIC(8,4),
    -- QW-451 qualified thickness range lower bound (inches)
  ADD COLUMN IF NOT EXISTS thickness_max_in     NUMERIC(8,4),
    -- QW-451 qualified thickness range upper bound (inches)
  ADD COLUMN IF NOT EXISTS od_min_in            NUMERIC(8,3),
    -- QW-403.18 qualified OD range lower bound for pipe (inches)
  ADD COLUMN IF NOT EXISTS pwht_condition       TEXT
    CHECK (pwht_condition IN ('as_welded', 'pwht', 'either'))
    DEFAULT 'as_welded',
    -- PWHT condition under which tested
  ADD COLUMN IF NOT EXISTS impact_tested        BOOLEAN DEFAULT false,
    -- Whether coupon included impact (Charpy) testing
  ADD COLUMN IF NOT EXISTS continuity_last_date DATE,
    -- Date of most recent qualifying weld for continuity (QW-322)
  ADD COLUMN IF NOT EXISTS standard             TEXT
    DEFAULT 'ASME IX'
    CHECK (standard IN ('ASME IX', 'API 1104', 'AWS D1.1', 'CSA W47.1'));
    -- Governing qualification standard

COMMENT ON COLUMN public.welder_certifications.p_number_base IS
  'ASME IX QW-422 P-Number of base metal tested. Required for P-number coverage check.';
COMMENT ON COLUMN public.welder_certifications.thickness_min_in IS
  'ASME IX QW-451 lower qualified thickness limit in inches.';
COMMENT ON COLUMN public.welder_certifications.thickness_max_in IS
  'ASME IX QW-451 upper qualified thickness limit in inches (typically 2× coupon thickness).';
COMMENT ON COLUMN public.welder_certifications.continuity_last_date IS
  'Date welder last used this process/position for continuity tracking per QW-322.';

-- ── Position coverage lookup ──────────────────────────────────
-- ENGINEERING_REVIEW_REQUIRED: Verify all coverage arrays against
-- ASME IX QW-461.9 Table before enabling qual enforcement.
CREATE TABLE IF NOT EXISTS public.position_coverage (
  tested_position   TEXT PRIMARY KEY,
  covers            TEXT[] NOT NULL,
  standard          TEXT NOT NULL DEFAULT 'ASME IX',
  notes             TEXT
);

COMMENT ON TABLE public.position_coverage IS
  'ENGINEERING_REVIEW_REQUIRED: Maps a tested position to the set of positions '
  'that qualification covers. Seeded for ASME IX per QW-461.9. '
  'Verify all entries before enabling PFOS_QUAL_ENFORCEMENT.';

-- RLS: read-only for all authenticated users
ALTER TABLE public.position_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "position_coverage_read" ON public.position_coverage
  FOR SELECT TO authenticated USING (true);

-- ── Seed: ASME IX QW-461.9 groove weld positions ─────────────
-- ENGINEERING_REVIEW_REQUIRED (RULE-001)
INSERT INTO public.position_coverage (tested_position, covers, standard, notes) VALUES
  ('1G',    ARRAY['1G'],                                   'ASME IX', 'Flat only'),
  ('2G',    ARRAY['1G','2G'],                              'ASME IX', 'Flat + horizontal'),
  ('3G',    ARRAY['1G','3G','4G'],                         'ASME IX', 'Flat + vertical + overhead'),
  ('4G',    ARRAY['1G','4G'],                              'ASME IX', 'Flat + overhead'),
  ('3G+4G', ARRAY['1G','3G','4G'],                         'ASME IX', 'Combined plate test'),
  ('5G',    ARRAY['1G','3G','4G','5G'],                    'ASME IX', 'Pipe — horizontal fixed'),
  ('6G',    ARRAY['1G','2G','3G','4G','5G','6G'],          'ASME IX', 'Pipe — inclined fixed; all positions'),
  ('6GR',   ARRAY['1G','2G','3G','4G','5G','6G','6GR'],   'ASME IX', 'Pipe with restrictor ring; all positions + restricted clearance'),
  -- Fillet weld positions
  ('1F',    ARRAY['1F'],                                   'ASME IX', 'Flat fillet'),
  ('2F',    ARRAY['1F','2F'],                              'ASME IX', 'Flat + horizontal fillet'),
  ('3F',    ARRAY['1F','2F','3F','4F'],                    'ASME IX', 'All fillet positions'),
  ('4F',    ARRAY['1F','2F','4F'],                         'ASME IX', 'Flat + horizontal + overhead fillet'),
  ('2F+3F', ARRAY['1F','2F','3F','4F'],                    'ASME IX', 'Combined fillet test — all fillet positions')
ON CONFLICT (tested_position) DO NOTHING;
