-- ============================================================
-- Phase 4: Spool Tracking
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Spool status enum ──────────────────────────────────────
CREATE TYPE spool_status AS ENUM (
  'designed',
  'material_released',
  'cut',
  'fit_up',
  'welded',
  'nde',
  'painted',
  'released'
);

-- ── Spools table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spools (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  spool_number     TEXT NOT NULL,
  revision         TEXT DEFAULT 'A',
  status           TEXT NOT NULL DEFAULT 'designed',

  -- Pipe spec
  pipe_size        TEXT,
  pipe_schedule    TEXT,
  material         TEXT,
  service          TEXT,           -- e.g. "Steam", "Process Water"
  design_pressure  NUMERIC(10,2),  -- PSI
  design_temp      NUMERIC(8,2),   -- °F

  -- Quantities
  total_welds      INTEGER DEFAULT 0,
  total_length_in  NUMERIC(10,3),  -- total pipe length in inches

  -- Tracking
  isometric_ref    TEXT,           -- drawing/iso reference
  area             TEXT,           -- plant area or unit
  priority         INTEGER DEFAULT 5, -- 1=highest, 10=lowest
  notes            TEXT,

  -- Dates
  required_date    DATE,
  released_date    DATE,

  created_by       UUID REFERENCES user_profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, spool_number)
);

-- ── Spool items (individual pipe pieces & fittings) ────────
CREATE TABLE IF NOT EXISTS spool_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spool_id        UUID NOT NULL REFERENCES spools(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  item_number     INTEGER NOT NULL,   -- line item #
  item_type       TEXT NOT NULL,      -- 'pipe', 'elbow', 'tee', 'flange', 'reducer', 'cap', 'other'
  description     TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  length_in       NUMERIC(10,3),      -- for pipe pieces, length in inches
  heat_number     TEXT,               -- material cert tracking
  is_cut          BOOLEAN DEFAULT FALSE,
  is_fitted       BOOLEAN DEFAULT FALSE,
  notes           TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Spool audit / history ──────────────────────────────────
-- Reuses the same audit_logs table — no new table needed.
-- action = 'INSERT' | 'UPDATE', table_name = 'spools'

-- ── Triggers ──────────────────────────────────────────────
CREATE TRIGGER spools_updated_at
  BEFORE UPDATE ON spools
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE spools      ENABLE ROW LEVEL SECURITY;
ALTER TABLE spool_items ENABLE ROW LEVEL SECURITY;

-- Spools: org members can read; editors/admins can write
CREATE POLICY "org members read spools"
  ON spools FOR SELECT
  USING (organization_id = get_my_org_id());

CREATE POLICY "org members insert spools"
  ON spools FOR INSERT
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "org members update spools"
  ON spools FOR UPDATE
  USING (organization_id = get_my_org_id());

CREATE POLICY "org members delete spools"
  ON spools FOR DELETE
  USING (organization_id = get_my_org_id());

-- Spool items
CREATE POLICY "org members read spool_items"
  ON spool_items FOR SELECT
  USING (organization_id = get_my_org_id());

CREATE POLICY "org members insert spool_items"
  ON spool_items FOR INSERT
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "org members update spool_items"
  ON spool_items FOR UPDATE
  USING (organization_id = get_my_org_id());

CREATE POLICY "org members delete spool_items"
  ON spool_items FOR DELETE
  USING (organization_id = get_my_org_id());

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX idx_spools_org       ON spools(organization_id);
CREATE INDEX idx_spools_project   ON spools(project_id);
CREATE INDEX idx_spools_status    ON spools(status);
CREATE INDEX idx_spool_items_spool ON spool_items(spool_id);
