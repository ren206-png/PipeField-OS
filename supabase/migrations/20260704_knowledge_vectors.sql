-- ============================================================
-- PipeField Intelligence Center — Phase 2 AI Search
-- Adds pgvector embeddings, query logging, and RPC function
-- ============================================================

-- Enable pgvector
create extension if not exists vector;

-- Add embedding column to knowledge_chunks
alter table knowledge_chunks
  add column if not exists embedding vector(1536);

-- Index for fast cosine similarity search
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ── Query logging ─────────────────────────────────────────────

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

-- ── RLS ───────────────────────────────────────────────────────

alter table knowledge_queries enable row level security;
alter table knowledge_query_sources enable row level security;

create policy "org_queries" on knowledge_queries for all
  using (organization_id in (
    select organization_id from user_profiles where auth_user_id = auth.uid()
  ));

create policy "org_query_sources" on knowledge_query_sources for all
  using (query_id in (
    select id from knowledge_queries where organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  ));

-- ── Grants ────────────────────────────────────────────────────

grant all on knowledge_queries to authenticated;
grant all on knowledge_query_sources to authenticated;

-- ── RPC: match_knowledge_chunks ───────────────────────────────
-- Used by /api/knowledge/ask for pgvector cosine similarity search.

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
