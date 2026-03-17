-- SmartCart backend relational schema (initial draft)
-- Ready to migrate to Postgres + Drizzle with RLS policies.

create table if not exists households (
  id uuid primary key,
  name text not null,
  owner_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists list_items (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  quantity numeric not null default 1,
  category text not null,
  purchased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  actor_id text not null,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists monthly_budgets (
  household_id uuid primary key references households(id) on delete cascade,
  month text not null,
  budget_limit numeric not null,
  spent numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists receipts (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  store text not null,
  total numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists receipt_items (
  id uuid primary key,
  receipt_id uuid not null references receipts(id) on delete cascade,
  name text not null,
  quantity numeric not null,
  unit_price numeric not null,
  total numeric not null
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

-- RLS sketch:
-- alter table households enable row level security;
-- create policy households_isolation on households
-- using (id in (select household_id from household_members where user_id = current_setting('app.user_id')));
