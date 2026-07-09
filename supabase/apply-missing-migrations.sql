-- ============================================================
-- apply-missing-migrations.sql
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor)
-- for your production project.
--
-- Includes:
--   20260702_wps.sql          → wps_records table + welds.wps_id column
--   20260703_knowledge_center.sql → knowledge_* tables + default categories
--   20260704_rls_missing_tables.sql → RLS for weld_repairs, wps_records,
--                                      project_milestones
--   20260704_knowledge_vectors.sql → pgvector + AI search tables
--
-- All statements are idempotent (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. WPS RECORDS
-- ────────────────────────────────────────────────────────────

create table if not exists wps_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  wps_number      text not null,
  revision        text not null default '0',
  process         text not null,
  base_metal_p_numbers text,
  filler_material text,
  thickness_min_in numeric(6,3),
  thickness_max_in numeric(6,3),
  position        text,
  pwht_required   boolean default false,
  notes           text,
  is_active       boolean default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create unique index if not exists wps_records_org_number_rev
  on wps_records(organization_id, wps_number, revision);

create index if not exists wps_records_org_idx
  on wps_records(organization_id);

alter table welds add column if not exists wps_id uuid references wps_records(id) on delete set null;
create index if not exists welds_wps_idx on welds(wps_id);


-- ────────────────────────────────────────────────────────────
-- 2. KNOWLEDGE CENTER
-- ────────────────────────────────────────────────────────────

-- 2a. Knowledge Categories
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

create index if not exists knowledge_categories_org_idx on knowledge_categories(organization_id);
create unique index if not exists knowledge_categories_org_slug_idx on knowledge_categories(organization_id, slug);

alter table knowledge_categories enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'knowledge_categories' and policyname = 'org members can read knowledge categories'
  ) then
    create policy "org members can read knowledge categories"
      on knowledge_categories for select using (
        organization_id in (
          select organization_id from user_profiles where auth_user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'knowledge_categories' and policyname = 'org admins can manage knowledge categories'
  ) then
    create policy "org admins can manage knowledge categories"
      on knowledge_categories for all using (
        organization_id in (
          select organization_id from user_profiles
          where auth_user_id = auth.uid()
            and role in ('platform_admin','organization_owner','administrator','project_manager')
        )
      );
  end if;
end $$;

-- 2b. Knowledge Sources
create table if not exists knowledge_sources (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations(id) on delete cascade,
  project_id        uuid        references projects(id) on delete set null,
  category_id       uuid        references knowledge_categories(id) on delete set null,
  title             text        not null,
  description       text,
  document_type     text        not null default 'other',
  related_module    text,
  file_name         text        not null,
  file_size         bigint,
  file_type         text        not null,
  storage_path      text        not null,
  public_url        text,
  tags              text[]      not null default '{}',
  visibility        text        not null default 'org',
  status            text        not null default 'active',
  version           text        not null default '1.0',
  superseded_by     uuid        references knowledge_sources(id) on delete set null,
  uploaded_by       uuid        not null references auth.users(id),
  processing_status text        not null default 'pending',
  chunk_count       integer     not null default 0,
  extracted_text    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists knowledge_sources_org_idx       on knowledge_sources(organization_id);
create index if not exists knowledge_sources_project_idx   on knowledge_sources(project_id);
create index if not exists knowledge_sources_category_idx  on knowledge_sources(category_id);
create index if not exists knowledge_sources_status_idx    on knowledge_sources(status);
create index if not exists knowledge_sources_uploader_idx  on knowledge_sources(uploaded_by);
create index if not exists knowledge_sources_tags_idx      on knowledge_sources using gin(tags);

alter table knowledge_sources enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_sources' and policyname = 'org members can read knowledge sources') then
    create policy "org members can read knowledge sources"
      on knowledge_sources for select using (
        organization_id in (select organization_id from user_profiles where auth_user_id = auth.uid())
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_sources' and policyname = 'org members can insert knowledge sources') then
    create policy "org members can insert knowledge sources"
      on knowledge_sources for insert with check (
        organization_id in (
          select organization_id from user_profiles
          where auth_user_id = auth.uid()
            and role in ('platform_admin','organization_owner','administrator','project_manager','foreman','qa_inspector','shop_fabricator')
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_sources' and policyname = 'org admins can update knowledge sources') then
    create policy "org admins can update knowledge sources"
      on knowledge_sources for update using (
        organization_id in (
          select organization_id from user_profiles
          where auth_user_id = auth.uid()
            and role in ('platform_admin','organization_owner','administrator','project_manager')
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_sources' and policyname = 'org admins can delete knowledge sources') then
    create policy "org admins can delete knowledge sources"
      on knowledge_sources for delete using (
        organization_id in (
          select organization_id from user_profiles
          where auth_user_id = auth.uid()
            and role in ('platform_admin','organization_owner','administrator')
        )
      );
  end if;
end $$;

-- 2c. Knowledge Chunks
create table if not exists knowledge_chunks (
  id              uuid        primary key default gen_random_uuid(),
  source_id       uuid        not null references knowledge_sources(id) on delete cascade,
  organization_id uuid        not null references organizations(id) on delete cascade,
  chunk_index     integer     not null,
  content         text        not null,
  token_count     integer,
  created_at      timestamptz not null default now()
);

create index if not exists knowledge_chunks_source_idx on knowledge_chunks(source_id);
create index if not exists knowledge_chunks_org_idx    on knowledge_chunks(organization_id);

alter table knowledge_chunks enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_chunks' and policyname = 'org members can read knowledge chunks') then
    create policy "org members can read knowledge chunks"
      on knowledge_chunks for select using (
        organization_id in (select organization_id from user_profiles where auth_user_id = auth.uid())
      );
  end if;
end $$;

-- 2d. Knowledge Tags
create table if not exists knowledge_tags (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  name            text        not null,
  color           text        not null default '#64748b',
  created_at      timestamptz not null default now(),
  unique(organization_id, name)
);

create index if not exists knowledge_tags_org_idx on knowledge_tags(organization_id);
alter table knowledge_tags enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_tags' and policyname = 'org members can manage knowledge tags') then
    create policy "org members can manage knowledge tags"
      on knowledge_tags for all using (
        organization_id in (select organization_id from user_profiles where auth_user_id = auth.uid())
      );
  end if;
end $$;

-- 2e. Knowledge Permissions
create table if not exists knowledge_permissions (
  id                  uuid        primary key default gen_random_uuid(),
  source_id           uuid        not null references knowledge_sources(id) on delete cascade,
  organization_id     uuid        not null references organizations(id) on delete cascade,
  granted_to_user     uuid        references auth.users(id) on delete cascade,
  granted_to_role     text,
  can_view            boolean     not null default true,
  can_query           boolean     not null default true,
  granted_by          uuid        not null references auth.users(id),
  created_at          timestamptz not null default now()
);

create index if not exists knowledge_permissions_source_idx  on knowledge_permissions(source_id);
create index if not exists knowledge_permissions_org_idx     on knowledge_permissions(organization_id);
create index if not exists knowledge_permissions_user_idx    on knowledge_permissions(granted_to_user);
alter table knowledge_permissions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_permissions' and policyname = 'org admins can manage knowledge permissions') then
    create policy "org admins can manage knowledge permissions"
      on knowledge_permissions for all using (
        organization_id in (
          select organization_id from user_profiles
          where auth_user_id = auth.uid()
            and role in ('platform_admin','organization_owner','administrator')
        )
      );
  end if;
end $$;

-- 2f. Knowledge Audit Log
create table if not exists knowledge_audit_log (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  source_id       uuid        references knowledge_sources(id) on delete set null,
  action          text        not null,
  performed_by    uuid        not null references auth.users(id),
  details         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists knowledge_audit_org_idx     on knowledge_audit_log(organization_id);
create index if not exists knowledge_audit_source_idx  on knowledge_audit_log(source_id);
create index if not exists knowledge_audit_by_idx      on knowledge_audit_log(performed_by);
create index if not exists knowledge_audit_date_idx    on knowledge_audit_log(created_at desc);
alter table knowledge_audit_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_audit_log' and policyname = 'org admins can read knowledge audit log') then
    create policy "org admins can read knowledge audit log"
      on knowledge_audit_log for select using (
        organization_id in (
          select organization_id from user_profiles
          where auth_user_id = auth.uid()
            and role in ('platform_admin','organization_owner','administrator','project_manager')
        )
      );
  end if;
end $$;

-- 2g. Seed default knowledge categories for existing orgs
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


-- ────────────────────────────────────────────────────────────
-- 3. RLS FOR PREVIOUSLY UNPROTECTED TABLES
-- ────────────────────────────────────────────────────────────

-- weld_repairs
alter table weld_repairs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'weld_repairs' and policyname = 'org members can manage weld repairs') then
    create policy "org members can manage weld repairs"
      on weld_repairs for all using (
        organization_id in (select organization_id from user_profiles where auth_user_id = auth.uid())
      );
  end if;
end $$;

-- wps_records (now that the table exists)
alter table wps_records enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'wps_records' and policyname = 'org members can manage WPS records') then
    create policy "org members can manage WPS records"
      on wps_records for all using (
        organization_id in (select organization_id from user_profiles where auth_user_id = auth.uid())
      );
  end if;
end $$;

-- project_milestones
alter table project_milestones enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'project_milestones' and policyname = 'org members can manage project milestones') then
    create policy "org members can manage project milestones"
      on project_milestones for all using (
        project_id in (
          select p.id
          from   projects p
          join   user_profiles up on up.organization_id = p.organization_id
          where  up.auth_user_id = auth.uid()
        )
      );
  end if;
end $$;


-- ────────────────────────────────────────────────────────────
-- 4. PGVECTOR + AI SEARCH (requires pgvector extension)
-- ────────────────────────────────────────────────────────────

create extension if not exists vector;

alter table knowledge_chunks
  add column if not exists embedding vector(1536);

create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Knowledge query log
create table if not exists knowledge_queries (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  asked_by        uuid        not null references user_profiles(id) on delete cascade,
  query_text      text        not null,
  answer_text     text,
  model_used      text        default 'gpt-4o-mini',
  tokens_used     int,
  latency_ms      int,
  source_count    int         default 0,
  created_at      timestamptz not null default now()
);

create table if not exists knowledge_query_sources (
  id               uuid        primary key default gen_random_uuid(),
  query_id         uuid        not null references knowledge_queries(id) on delete cascade,
  chunk_id         uuid        not null references knowledge_chunks(id) on delete cascade,
  source_id        uuid        not null references knowledge_sources(id) on delete cascade,
  similarity_score float,
  created_at       timestamptz not null default now()
);

alter table knowledge_queries       enable row level security;
alter table knowledge_query_sources enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_queries' and policyname = 'org_queries') then
    create policy "org_queries" on knowledge_queries for all
      using (organization_id in (
        select organization_id from user_profiles where auth_user_id = auth.uid()
      ));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'knowledge_query_sources' and policyname = 'org_query_sources') then
    create policy "org_query_sources" on knowledge_query_sources for all
      using (query_id in (
        select id from knowledge_queries where organization_id in (
          select organization_id from user_profiles where auth_user_id = auth.uid()
        )
      ));
  end if;
end $$;

grant all on knowledge_queries        to authenticated;
grant all on knowledge_query_sources  to authenticated;

create or replace function match_knowledge_chunks(
  query_embedding    vector(1536),
  org_id             uuid,
  match_count        int  default 8,
  filter_project_id  uuid default null
)
returns table (
  chunk_id      uuid,
  source_id     uuid,
  content       text,
  chunk_index   int,
  title         text,
  document_type text,
  file_name     text,
  public_url    text,
  source_status text,
  similarity    float
)
language plpgsql
as $$
begin
  return query
  select
    kc.id                                         as chunk_id,
    kc.source_id,
    kc.content,
    kc.chunk_index,
    ks.title,
    ks.document_type,
    ks.file_name,
    ks.public_url,
    ks.status                                     as source_status,
    1 - (kc.embedding <=> query_embedding)        as similarity
  from knowledge_chunks kc
  join knowledge_sources ks on ks.id = kc.source_id
  where ks.organization_id = org_id
    and ks.status = 'active'
    and kc.embedding is not null
    and (filter_project_id is null or ks.project_id = filter_project_id)
  order by kc.embedding <=> query_embedding
  limit match_count;
end;
$$;
