-- 0027: polling-unit incident reports use the same live-camera, GPS, one-time-session rules as result evidence.
-- Additive only: preserves existing result submissions, uploads, users and assignments.
create table if not exists polling_incident_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete restrict,
  assignment_id uuid not null references assignments(id) on delete restrict,
  polling_unit_id uuid not null references polling_units(id) on delete restrict,
  election_id uuid not null references elections(id) on delete restrict,
  contest_type text not null check (contest_type in ('presidential','governorship','senatorial','house_of_reps','state_assembly')),
  evidence_type text not null check (evidence_type in ('incident_photo','incident_video')),
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
create index if not exists polling_incident_sessions_agent_idx on polling_incident_capture_sessions(agent_id, expires_at desc);
alter table polling_incident_capture_sessions enable row level security;

create table if not exists polling_incidents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete restrict,
  assignment_id uuid not null references assignments(id) on delete restrict,
  polling_unit_id uuid not null references polling_units(id) on delete restrict,
  election_id uuid not null references elections(id) on delete restrict,
  contest_type text not null check (contest_type in ('presidential','governorship','senatorial','house_of_reps','state_assembly')),
  evidence_type text not null check (evidence_type in ('incident_photo','incident_video')),
  incident_category text not null check (incident_category in ('violence_or_threat','result_interference','intimidation','process_irregularity','access_or_materials','other')),
  severity text not null check (severity in ('low','medium','high','critical')),
  description text not null check (char_length(btrim(description)) between 1 and 4000),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg','video/webm','video/mp4')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  capture_method text not null check (capture_method = 'in_app_live_camera'),
  client_captured_at timestamptz,
  server_received_at timestamptz not null default now(),
  reported_lat double precision not null,
  reported_lon double precision not null,
  reported_accuracy_m double precision not null,
  location_time timestamptz not null,
  distance_m double precision not null,
  geofence_outcome text not null check (geofence_outcome = 'within_radius'),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','needs_review')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists polling_incidents_review_idx on polling_incidents(election_id, polling_unit_id, verification_status, server_received_at desc);
create index if not exists polling_incidents_agent_idx on polling_incidents(agent_id, server_received_at desc);
alter table polling_incidents enable row level security;

create table if not exists polling_incident_audit (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references polling_incidents(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists polling_incident_audit_incident_idx on polling_incident_audit(incident_id, created_at);
alter table polling_incident_audit enable row level security;
-- No direct client insert/update/delete policies. All incident records, sessions, and audit rows are written by trusted server routes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('polling-incident-evidence', 'polling-incident-evidence', false, 26214400, array['image/jpeg','video/webm','video/mp4'])
on conflict (id) do update set public = false, file_size_limit = 26214400, allowed_mime_types = array['image/jpeg','video/webm','video/mp4'];
