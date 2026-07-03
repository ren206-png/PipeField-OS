create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- null = org-wide
  type text not null, -- 'weld_failed', 'ncr_created', 'rfi_created', 'weld_accepted', 'repair_required'
  title text not null,
  body text not null,
  href text, -- link to click through to
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications(organization_id, user_id, read, created_at desc);
alter table notifications enable row level security;
create policy "org members can read their notifications"
  on notifications for select using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
    and (user_id is null or user_id = auth.uid())
  );
create policy "service role can insert"
  on notifications for insert with check (true);
create policy "users can update their own notifications"
  on notifications for update using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );
