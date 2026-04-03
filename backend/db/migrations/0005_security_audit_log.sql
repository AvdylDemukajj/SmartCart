-- Phase 9: security audit durability and forensic indexing.

create table if not exists security_audit_log (
  id uuid primary key,
  event text not null,
  request_id uuid,
  user_id text,
  path text,
  reason text,
  created_at timestamptz not null default now(),
  prev_hash text,
  hash text not null
);

create index if not exists idx_security_audit_log_created_at on security_audit_log (created_at desc);
create index if not exists idx_security_audit_log_event_created_at on security_audit_log (event, created_at desc);
create unique index if not exists idx_security_audit_log_hash on security_audit_log (hash);
