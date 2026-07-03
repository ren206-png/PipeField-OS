-- ============================================================
-- PipeField Intelligence Center — Phase 1 Foundation
-- All tables follow org-scoping pattern:
--   organization_id uuid not null references organizations(id)
--   RLS: organization_id in (select organization_id from user_profiles
--                            where auth_user_id = auth.uid())
--
-- STORAGE SETUP (manual step in Supabase Dashboard):
--   Storage → New Bucket → name: "knowledge-docs"
--   Public: true
--   File size limit: 52428800 (50 MB)
--   Allowed MIME types: (leave blank to allow all listed in app)
-- ============================================================

-- ── 1. Knowledge Categories ──────────────────────────────────
create table if not exists knowledge_categories (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  name            text        not null,
  slug            text        not null,
  description     text,
  color           text        not null default '#64748b',
  is_default      boolean     not null default false,
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now()
);

create index on knowledge_categories(organization_id);
create unique index on knowledge_categories(organization_id, slug);

alter table knowledge_categories enable row level security;

create policy "org members can read knowledge categories"
  on knowledge_categories for select using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );

create policy "org admins can manage knowledge categories"
  on knowledge_categories for all using (
    organization_id in (
      select organization_id from user_profiles
      where auth_user_id = auth.uid()
        and role in ('platform_admin','organization_owner','administrator','project_manager')
    )
  );

-- ── 2. Knowledge Sources (uploaded documents) ────────────────
create table if not exists knowledge_sources (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations(id) on delete cascade,
  project_id        uuid        references projects(id) on delete set null,
  category_id       uuid        references knowledge_categories(id) on delete set null,

  -- Document identity
  title             text        not null,
  description       text,
  document_type     text        not null default 'other',
    -- procedure | report | specification | drawing | lessons_learned
    -- method_statement | safety | training | client_spec | other
  related_module    text,
    -- weld_tracking | qa_qc | spool_tracking | safety
    -- project_management | commissioning | training | general

  -- File info (Supabase Storage)
  file_name         text        not null,
  file_size         bigint,
  file_type         text        not null,   -- MIME type
  storage_path      text        not null,   -- path in "knowledge-docs" bucket
  public_url        text,

  -- Categorisation
  tags              text[]      not null default '{}',
  visibility        text        not null default 'org',
    -- org | project | restricted
  status            text        not null default 'active',
    -- active | archived | superseded
  version           text        not null default '1.0',
  superseded_by     uuid        references knowledge_sources(id) on delete set null,

  -- Authorship
  uploaded_by       uuid        not null references auth.users(id),

  -- AI processing (populated in Phase 2)
  processing_status text        not null default 'pending',
    -- pending | processing | ready | failed
  chunk_count       integer     not null default 0,
  extracted_text    text,       -- raw extracted text (populated Phase 2)

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on knowledge_sources(organization_id);
create index on knowledge_sources(project_id);
create index on knowledge_sources(category_id);
create index on knowledge_sources(status);
create index on knowledge_sources(uploaded_by);
create index on knowledge_sources using gin(tags);

alter table knowledge_sources enable row level security;

create policy "org members can read knowledge sources"
  on knowledge_sources for select using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );

create policy "org members can insert knowledge sources"
  on knowledge_sources for insert with check (
    organization_id in (
      select organization_id from user_profiles
      where auth_user_id = auth.uid()
        and role in (
          'platform_admin','organization_owner','administrator',
          'project_manager','foreman','qa_inspector','shop_fabricator'
        )
    )
  );

create policy "org admins can update knowledge sources"
  on knowledge_sources for update using (
    organization_id in (
      select organization_id from user_profiles
      where auth_user_id = auth.uid()
        and role in ('platform_admin','organization_owner','administrator','project_manager')
    )
  );

create policy "org admins can delete knowledge sources"
  on knowledge_sources for delete using (
    organization_id in (
      select organization_id from user_profiles
      where auth_user_id = auth.uid()
        and role in ('platform_admin','organization_owner','administrator')
    )
  );

-- ── 3. Knowledge Chunks (vector chunks — Phase 2 populates) ──
create table if not exists knowledge_chunks (
  id              uuid        primary key default gen_random_uuid(),
  source_id       uuid        not null references knowledge_sources(id) on delete cascade,
  organization_id uuid        not null references organizations(id) on delete cascade,
  chunk_index     integer     not null,
  content         text        not null,
  token_count     integer,
  -- NOTE: embedding vector column added in Phase 2 migration once
  -- pgvector extension is confirmed enabled on the Supabase instance.
  created_at      timestamptz not null default now()
);

create index on knowledge_chunks(source_id);
create index on knowledge_chunks(organization_id);

alter table knowledge_chunks enable row level security;

create policy "org members can read knowledge chunks"
  on knowledge_chunks for select using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );

-- ── 4. Knowledge Tags ────────────────────────────────────────
create table if not exists knowledge_tags (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  name            text        not null,
  color           text        not null default '#64748b',
  created_at      timestamptz not null default now(),
  unique(organization_id, name)
);

create index on knowledge_tags(organization_id);

alter table knowledge_tags enable row level security;

create policy "org members can manage knowledge tags"
  on knowledge_tags for all using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );

-- ── 5. Knowledge Permissions (per-document access overrides) ─
create table if not exists knowledge_permissions (
  id                  uuid        primary key default gen_random_uuid(),
  source_id           uuid        not null references knowledge_sources(id) on delete cascade,
  organization_id     uuid        not null references organizations(id) on delete cascade,
  granted_to_user     uuid        references auth.users(id) on delete cascade,
  granted_to_role     text,       -- UserRole string value
  can_view            boolean     not null default true,
  can_query           boolean     not null default true,
  granted_by          uuid        not null references auth.users(id),
  created_at          timestamptz not null default now()
);

create index on knowledge_permissions(source_id);
create index on knowledge_permissions(organization_id);
create index on knowledge_permissions(granted_to_user);

alter table knowledge_permissions enable row level security;

create policy "org admins can manage knowledge permissions"
  on knowledge_permissions for all using (
    organization_id in (
      select organization_id from user_profiles
      where auth_user_id = auth.uid()
        and role in ('platform_admin','organization_owner','administrator')
    )
  );

-- ── 6. Knowledge Audit Log ───────────────────────────────────
create table if not exists knowledge_audit_log (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  source_id       uuid        references knowledge_sources(id) on delete set null,
  action          text        not null,
    -- upload | edit | delete | archive | supersede | permission_change | query
  performed_by    uuid        not null references auth.users(id),
  details         jsonb,
  created_at      timestamptz not null default now()
);

create index on knowledge_audit_log(organization_id);
create index on knowledge_audit_log(source_id);
create index on knowledge_audit_log(performed_by);
create index on knowledge_audit_log(created_at desc);

alter table knowledge_audit_log enable row level security;

create policy "org admins can read knowledge audit log"
  on knowledge_audit_log for select using (
    organization_id in (
      select organization_id from user_profiles
      where auth_user_id = auth.uid()
        and role in ('platform_admin','organization_owner','administrator','project_manager')
    )
  );

-- Admin insert only (server-side via service role)
-- No insert RLS needed — inserts always go through admin client

-- ── 7. Seed default categories for existing orgs ─────────────
-- New orgs get these via the API on first visit.
-- This inserts defaults for any org that doesn't have categories yet.
-- (Safe to re-run — INSERT ... WHERE NOT EXISTS)
insert into knowledge_categories
  (organization_id, name, slug, description, color, is_default, sort_order)
select
  o.id,
  cat.name,
  cat.slug,
  cat.description,
  cat.color,
  true,
  cat.sort_order
from organizations o
cross join (values
  ('Welding',               'welding',               'Welding procedures, WPS, PQR, weld maps',                    '#f97316', 1),
  ('QA/QC',                 'qa-qc',                 'Quality plans, ITPs, inspection procedures',                  '#3b82f6', 2),
  ('Hydrotesting',          'hydrotesting',          'Hydrotest procedures, records, pressure calculations',        '#06b6d4', 3),
  ('Flange Management',     'flange-management',     'Flange torque specs, gasket specs, bolt charts',             '#8b5cf6', 4),
  ('Spool Fabrication',     'spool-fabrication',     'Fab drawings, isometrics, cut sheets',                       '#ec4899', 5),
  ('Field Installation',    'field-installation',    'Field install procedures, fit-up guides, alignment specs',    '#10b981', 6),
  ('Safety',                'safety',                'JSAs, SIMOPS, permits, toolbox talks, MSDS',                 '#ef4444', 7),
  ('Shutdowns/Turnarounds', 'shutdowns-turnarounds', 'Turnaround plans, scope lists, critical path docs',          '#f59e0b', 8),
  ('Equipment',             'equipment',             'Equipment datasheets, manuals, maintenance records',          '#6366f1', 9),
  ('Client Specifications', 'client-specifications', 'Client specs, standards, engineering holds',                  '#14b8a6', 10),
  ('Lessons Learned',       'lessons-learned',       'Post-job reviews, defect analyses, improvement notes',        '#84cc16', 11),
  ('Training',              'training',              'Training materials, competency records, toolbox content',     '#a855f7', 12),
  ('Material Handling',     'material-handling',     'Material receiving, storage, traceability procedures',       '#f97316', 13),
  ('Productivity',          'productivity',          'Best practices, efficiency tips, benchmarks',                 '#22c55e', 14),
  ('Defect Prevention',     'defect-prevention',     'Root cause analyses, repair trends, NDT failure analysis',   '#ef4444', 15),
  ('Crew Management',       'crew-management',       'Crew rotations, competency matrices, workforce planning',    '#64748b', 16)
) as cat(name, slug, description, color, sort_order)
where not exists (
  select 1 from knowledge_categories
  where organization_id = o.id
);
