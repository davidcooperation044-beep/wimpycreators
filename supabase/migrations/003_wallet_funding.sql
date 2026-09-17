create table if not exists public.wc_wallet_fundings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  amount_kobo integer not null,
  reference text not null unique,
  status text not null default 'pending',
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

alter table public.wc_wallet_fundings enable row level security;
create policy "users view own fundings" on public.wc_wallet_fundings for select using (auth.uid() = user_id);
