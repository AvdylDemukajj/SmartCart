-- Phase 8: optimistic locking support for DB-first list item updates.

alter table list_items
add column if not exists version int not null default 1;
