create table if not exists public.ctrader_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  encrypted_payload text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);

alter table public.ctrader_connections enable row level security;

revoke all on table public.ctrader_connections from anon, authenticated;
grant all on table public.ctrader_connections to service_role;
