create table if not exists public.wc_payment_reconciliation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  amount_kobo integer not null,
  reason text not null,
  wimpypay_reference text,
  created_at timestamptz not null default now()
);

alter table public.wc_tips add column if not exists idempotency_key uuid;
alter table public.wc_tips add column if not exists wimpypay_reference text;
alter table public.wc_subscriptions add column if not exists idempotency_key uuid;
alter table public.wc_subscriptions add column if not exists wimpypay_reference text;
alter table public.wc_payouts add column if not exists idempotency_key uuid;
alter table public.wc_payouts add column if not exists wimpypay_reference text;
alter table public.wc_subscription_charges add column if not exists idempotency_key uuid;
alter table public.wc_subscription_charges add column if not exists wimpypay_reference text;
alter table public.wc_subscriptions add column if not exists renewal_attempts integer not null default 0;

create unique index if not exists wc_tips_idempotency_key_unique on public.wc_tips (idempotency_key) where idempotency_key is not null;
create unique index if not exists wc_subscriptions_idempotency_key_unique on public.wc_subscriptions (idempotency_key) where idempotency_key is not null;
create unique index if not exists wc_payouts_idempotency_key_unique on public.wc_payouts (idempotency_key) where idempotency_key is not null;
create unique index if not exists wc_subscription_charges_idempotency_key_unique on public.wc_subscription_charges (idempotency_key) where idempotency_key is not null;

alter table public.wc_payment_reconciliation enable row level security;
create policy "service role manages reconciliation" on public.wc_payment_reconciliation for all using (auth.role() = 'service_role');

alter table public.wc_creators add constraint wc_creators_user_id_unique unique (user_id);
create unique index if not exists wc_payouts_one_active_per_creator on public.wc_payouts (creator_id) where status in ('pending', 'processing');

insert into storage.buckets (id, name, public)
values ('creator-assets', 'creator-assets', true)
on conflict (id) do update set public = true;

create policy "public can read creator assets" on storage.objects for select using (bucket_id = 'creator-assets');
create policy "owners upload creator assets" on storage.objects for insert with check (bucket_id = 'creator-assets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owners update creator assets" on storage.objects for update using (bucket_id = 'creator-assets' and auth.uid()::text = (storage.foldername(name))[1]) with check (bucket_id = 'creator-assets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owners delete creator assets" on storage.objects for delete using (bucket_id = 'creator-assets' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners delete posts" on public.wc_posts for delete using (exists (select 1 from public.wc_creators c where c.id = creator_id and c.user_id = auth.uid()));
