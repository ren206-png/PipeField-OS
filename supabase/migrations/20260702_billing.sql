alter table organizations add column if not exists plan text not null default 'free';
alter table organizations add column if not exists stripe_customer_id text;
alter table organizations add column if not exists stripe_subscription_id text;
