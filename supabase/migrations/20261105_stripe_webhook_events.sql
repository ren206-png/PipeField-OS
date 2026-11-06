-- Stripe webhook idempotency: Stripe may deliver the same event more than
-- once. The webhook inserts the event id first; a conflict means "already
-- handled" and the event is acknowledged without being processed again.
-- Service-role only (RLS on, no policies) — never exposed to clients.
create table if not exists public.stripe_webhook_events (
  id            text primary key,          -- Stripe event id (evt_…)
  type          text not null,
  received_at   timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at);
