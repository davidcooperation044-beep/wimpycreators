create extension if not exists pgcrypto;

create table if not exists public.wc_creators (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  stage_name text not null, bio text, avatar_url text, banner_url text, category text,
  social_links jsonb default '{}', payout_recipient_code text, is_verified boolean default false,
  created_at timestamptz default now()
);
create table if not exists public.wc_membership_tiers (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.wc_creators(id) on delete cascade,
  name text not null, price_kobo integer not null, perks jsonb default '[]', is_active boolean default true, created_at timestamptz default now()
);
create table if not exists public.wc_subscriptions (
  id uuid primary key default gen_random_uuid(), subscriber_id uuid not null references auth.users(id), creator_id uuid not null references public.wc_creators(id) on delete cascade,
  tier_id uuid not null references public.wc_membership_tiers(id), status text not null default 'active', started_at timestamptz default now(), renews_at timestamptz not null, cancelled_at timestamptz
);
create table if not exists public.wc_tips (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id), creator_id uuid not null references public.wc_creators(id) on delete cascade,
  amount_kobo integer not null, message text, source_product text default 'wimpycreators', created_at timestamptz default now()
);
create table if not exists public.wc_posts (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.wc_creators(id) on delete cascade,
  title text, content text, media_url text, visibility text not null default 'public', created_at timestamptz default now()
);
create table if not exists public.wc_follows (
  id uuid primary key default gen_random_uuid(), follower_id uuid not null references auth.users(id), creator_id uuid not null references public.wc_creators(id) on delete cascade,
  created_at timestamptz default now(), unique(follower_id, creator_id)
);
create table if not exists public.wc_payouts (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.wc_creators(id) on delete cascade,
  amount_kobo integer not null, status text not null default 'pending', paystack_transfer_code text, requested_at timestamptz default now(), processed_at timestamptz
);
create table if not exists public.wc_subscription_charges (
  id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.wc_subscriptions(id) on delete cascade,
  creator_id uuid not null references public.wc_creators(id) on delete cascade, amount_kobo integer not null, charged_at timestamptz default now()
);

alter table public.wc_creators enable row level security;
alter table public.wc_membership_tiers enable row level security;
alter table public.wc_subscriptions enable row level security;
alter table public.wc_tips enable row level security;
alter table public.wc_posts enable row level security;
alter table public.wc_follows enable row level security;
alter table public.wc_payouts enable row level security;
alter table public.wc_subscription_charges enable row level security;

create policy "public can view creators" on public.wc_creators for select using (true);
create policy "owners create creators" on public.wc_creators for insert with check (auth.uid() = user_id);
create policy "owners update creators" on public.wc_creators for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public can view active tiers" on public.wc_membership_tiers for select using (is_active or exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy "owners manage tiers" on public.wc_membership_tiers for all using (exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid())) with check (exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy "participants view subscriptions" on public.wc_subscriptions for select using (auth.uid() = subscriber_id or exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy "subscribers cancel own subscriptions" on public.wc_subscriptions for update using (auth.uid() = subscriber_id) with check (auth.uid() = subscriber_id and status = 'cancelled');
create policy "participants view tips" on public.wc_tips for select using (auth.uid() = sender_id or exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy "public posts and unlocked tier posts" on public.wc_posts for select using (visibility = 'public' or exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()) or exists (select 1 from public.wc_subscriptions s where s.creator_id = wc_posts.creator_id and s.subscriber_id = auth.uid() and s.tier_id::text = replace(wc_posts.visibility, 'tier:', '') and s.status = 'active'));
create policy "owners create posts" on public.wc_posts for insert with check (exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy "owners update posts" on public.wc_posts for update using (exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy "public can view follow counts" on public.wc_follows for select using (true);
create policy "users manage own follows" on public.wc_follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
create policy "owners view payouts" on public.wc_payouts for select using (exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy "participants view subscription charges" on public.wc_subscription_charges for select using (exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()));

create index if not exists wc_creators_category_idx on public.wc_creators(category);
create index if not exists wc_posts_creator_created_idx on public.wc_posts(creator_id, created_at desc);