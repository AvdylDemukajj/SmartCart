-- Phase 7: align migration chain with schema.sql and extend tenant RLS coverage.

create table if not exists activity_log (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  actor_id text not null,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists pantry_items (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  quantity numeric not null,
  added_at timestamptz not null default now()
);

create table if not exists store_prices_live (
  id uuid primary key,
  store text not null,
  item_key text not null,
  unit_price numeric not null,
  source text,
  fetched_at timestamptz not null default now(),
  unique (store, item_key)
);

create table if not exists flyer_offers (
  id uuid primary key,
  store text not null,
  keyword text not null,
  discount_percent int not null,
  label text not null,
  valid_from date,
  valid_to date
);

alter table activity_log enable row level security;
alter table pantry_items enable row level security;

create policy activity_log_member_policy on activity_log
for all
using (
  exists (
    select 1 from household_members hm
    where hm.household_id = activity_log.household_id
      and hm.user_id = app_current_user_id()
  )
)
with check (
  exists (
    select 1 from household_members hm
    where hm.household_id = activity_log.household_id
      and hm.user_id = app_current_user_id()
  )
);

drop policy if exists pantry_member_policy on pantry_items;
create policy pantry_member_policy on pantry_items
for all
using (
  exists (
    select 1 from household_members hm
    where hm.household_id = pantry_items.household_id
      and hm.user_id = app_current_user_id()
  )
)
with check (
  exists (
    select 1 from household_members hm
    where hm.household_id = pantry_items.household_id
      and hm.user_id = app_current_user_id()
  )
);
