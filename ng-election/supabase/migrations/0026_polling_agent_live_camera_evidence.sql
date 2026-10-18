-- 0026: require one-time in-app camera capture sessions for polling-unit result-sheet evidence.
-- Additive: preserves existing submissions and document records.
create table if not exists polling_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete restrict,
  assignment_id uuid not null references assignments(id) on delete restrict,
  polling_unit_id uuid not null references polling_units(id) on delete restrict,
  submission_id uuid not null references result_submissions(id) on delete restrict,
  nonce_hash text not null unique,
  storage_path text unique,
  initial_lat double precision not null,
  initial_lon double precision not null,
  initial_accuracy_m double precision not null,
  initial_location_time timestamptz not null,
  initial_distance_m double precision not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists polling_capture_sessions_agent_idx on polling_capture_sessions(agent_id, expires_at desc);
alter table polling_capture_sessions enable row level security;
-- All reads/writes occur through authenticated, validating server routes using service role.

alter table submission_documents add column if not exists sha256 text;
alter table submission_documents add column if not exists capture_method text not null default 'legacy_upload' check (capture_method in ('legacy_upload','in_app_live_camera'));
alter table submission_documents add column if not exists capture_session_id uuid references polling_capture_sessions(id) on delete restrict;

-- Prevent direct client inserts; trusted API registers validated camera-capture documents with service role.
drop policy if exists owner_insert on submission_documents;

-- Prevent future PDF/PNG/WebP writes to the result-sheet bucket through any direct storage path.
update storage.buckets set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg'] where id = 'result-sheets';
