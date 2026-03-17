-- Phase 6: enable RLS policies for tenant-bound tables.

create or replace function app_current_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '');
$$;

alter table households enable row level security;
alter table household_members enable row level security;
alter table list_items enable row level security;
alter table monthly_budgets enable row level security;
alter table receipts enable row level security;
alter table pantry_items enable row level security;

create policy households_select_member on households
for select
using (
  exists (
    select 1
    from household_members hm
    where hm.household_id = households.id
      and hm.user_id = app_current_user_id()
  )
);

create policy households_insert_owner on households
for insert
with check (owner_id = app_current_user_id());

create policy households_update_owner on households
for update
using (owner_id = app_current_user_id())
with check (owner_id = app_current_user_id());

create policy household_members_member_access on household_members
for select
using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_members.household_id
      and hm.user_id = app_current_user_id()
  )
);

create policy household_members_insert_owner on household_members
for insert
with check (
  exists (
    select 1 from households h
    where h.id = household_members.household_id
      and h.owner_id = app_current_user_id()
  )
);

create policy list_items_member_policy on list_items
for all
using (
  exists (
    select 1 from household_members hm
    where hm.household_id = list_items.household_id
      and hm.user_id = app_current_user_id()
  )
)
with check (
  exists (
    select 1 from household_members hm
    where hm.household_id = list_items.household_id
      and hm.user_id = app_current_user_id()
  )
);

create policy budgets_member_policy on monthly_budgets
for all
using (
  exists (
    select 1 from household_members hm
    where hm.household_id = monthly_budgets.household_id
      and hm.user_id = app_current_user_id()
  )
)
with check (
  exists (
    select 1 from household_members hm
    where hm.household_id = monthly_budgets.household_id
      and hm.user_id = app_current_user_id()
  )
);

create policy receipts_member_policy on receipts
for all
using (
  exists (
    select 1 from household_members hm
    where hm.household_id = receipts.household_id
      and hm.user_id = app_current_user_id()
  )
)
with check (
  exists (
    select 1 from household_members hm
    where hm.household_id = receipts.household_id
      and hm.user_id = app_current_user_id()
  )
);

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
