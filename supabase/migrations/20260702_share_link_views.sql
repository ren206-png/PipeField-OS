create table if not exists share_link_views (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references client_share_links(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  viewer_ip text,
  viewer_ua text
);
create index on share_link_views(share_link_id);
create index on share_link_views(viewed_at);
-- No RLS needed — inserts happen server-side via admin client
