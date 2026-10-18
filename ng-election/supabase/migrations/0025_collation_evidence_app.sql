-- 0025: dedicated collation-centre agent app and camera-captured evidence.
-- Additive migration; existing polling-unit submissions and evidence are untouched.
alter type app_role add value if not exists 'collation_agent';

create table if not exists collation_centres (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id) on delete restrict,
  contest_type contest_type not null,
  name text not null check (char_length(btrim(name)) between 2 and 180),
  state_id uuid not null references states(id),
  lga_id uuid references lgas(id),
  address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  geocode_status text not null default 'pending' check (geocode_status in ('pending','verified','rejected')),
  geofence_radius_m integer not null default 200 check (geofence_radius_m between 25 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collation_centres_election_idx on collation_centres(election_id, contest_type, active);

create table if not exists collation_assignments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete restrict,
  centre_id uuid not null references collation_centres(id) on delete restrict,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','revoked')),
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create index if not exists collation_assignments_agent_idx on collation_assignments(agent_id, status, starts_at, expires_at);
create index if not exists collation_assignments_centre_idx on collation_assignments(centre_id, status);

create table if not exists collation_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete restrict,
  assignment_id uuid not null references collation_assignments(id) on delete restrict,
  centre_id uuid not null references collation_centres(id) on delete restrict,
  election_id uuid not null references elections(id) on delete restrict,
  contest_type contest_type not null,
  evidence_type text not null check (evidence_type in ('ec8a','incident_photo','incident_video')),
  nonce_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  initial_lat double precision not null,
  initial_lon double precision not null,
  initial_accuracy_m double precision not null,
  initial_location_time timestamptz not null,
  initial_distance_m double precision not null,
  initial_geofence_outcome text not null check (initial_geofence_outcome = 'within_radius')
);
create index if not exists collation_capture_sessions_agent_idx on collation_capture_sessions(agent_id, expires_at desc);

create table if not exists collation_evidence (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete restrict,
  assignment_id uuid not null references collation_assignments(id) on delete restrict,
  centre_id uuid not null references collation_centres(id) on delete restrict,
  election_id uuid not null references elections(id) on delete restrict,
  contest_type contest_type not null,
  evidence_type text not null check (evidence_type in ('ec8a','incident_photo','incident_video')),
  incident_category text,
  severity text check (severity is null or severity in ('low','medium','high','critical')),
  description text,
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  client_captured_at timestamptz,
  server_received_at timestamptz not null default now(),
  reported_lat double precision not null,
  reported_lon double precision not null,
  reported_accuracy_m double precision not null,
  location_time timestamptz not null,
  distance_m double precision not null,
  geofence_outcome text not null check (geofence_outcome in ('within_radius','outside_radius','poor_accuracy','gps_missing','stale_location','centre_coordinates_unverified','centre_coordinates_missing')),
  capture_method text not null default 'in_app_live_camera' check (capture_method = 'in_app_live_camera'),
  verification_status text not null default 'pending_verification' check (verification_status in ('pending_verification','verified','rejected','flagged')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists collation_evidence_review_idx on collation_evidence(election_id, centre_id, verification_status, server_received_at desc);
create index if not exists collation_evidence_agent_idx on collation_evidence(agent_id, server_received_at desc);

create table if not exists collation_evidence_audit (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid references collation_evidence(id) on delete restrict,
  actor_id uuid references auth.users(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists collation_evidence_audit_idx on collation_evidence_audit(evidence_id, created_at);

alter table collation_centres enable row level security;
alter table collation_assignments enable row level security;
alter table collation_capture_sessions enable row level security;
alter table collation_evidence enable row level security;
alter table collation_evidence_audit enable row level security;

-- No client write policies for capture sessions/evidence/audit. Trusted API validates identity,
-- assignment, election lock, geofence and bytes before service-role writes.
create policy collation_centres_admin_read on collation_centres for select to authenticated
  using (has_role('super_admin') or has_role('election_admin') or exists (
    select 1 from collation_assignments ca where ca.centre_id = id and ca.agent_id = auth.uid()
      and ca.status = 'active' and now() between ca.starts_at and ca.expires_at));
create policy collation_centres_admin_manage on collation_centres for all to authenticated
  using (has_role('super_admin') or has_role('election_admin'))
  with check (has_role('super_admin') or has_role('election_admin'));
create policy collation_assignments_scoped_read on collation_assignments for select to authenticated
  using (agent_id = auth.uid() or has_role('super_admin') or has_role('election_admin'));
create policy collation_assignments_admin_manage on collation_assignments for all to authenticated
  using ((has_role('super_admin') or has_role('election_admin')) and approved_by = auth.uid())
  with check ((has_role('super_admin') or has_role('election_admin')) and approved_by = auth.uid());
create policy collation_evidence_scoped_read on collation_evidence for select to authenticated
  using (agent_id = auth.uid() or has_role('super_admin') or has_role('election_admin') or exists (
    select 1 from user_roles ur join collation_centres cc on cc.id = collation_evidence.centre_id
    where ur.user_id = auth.uid() and ur.role in ('verifier','state_admin','lga_coordinator','supervisor')
      and ur.state_id = cc.state_id and (ur.lga_id is null or ur.lga_id = cc.lga_id)));
create policy collation_audit_admin_read on collation_evidence_audit for select to authenticated
  using (has_role('super_admin') or has_role('election_admin') or has_role('verifier'));

create or replace function audit_collation_evidence_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.verification_status is distinct from new.verification_status
     or old.review_note is distinct from new.review_note then
    insert into collation_evidence_audit(evidence_id, actor_id, action, detail)
    values (new.id, auth.uid(), 'review_changed', jsonb_build_object(
      'old_status', old.verification_status, 'new_status', new.verification_status,
      'review_note', new.review_note));
  end if;
  return new;
end $$;
create trigger collation_evidence_review_audit after update on collation_evidence
for each row execute function audit_collation_evidence_review();

-- Private evidence bucket. Only trusted server routes use the service role for storage writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collation-evidence', 'collation-evidence', false, 26214400,
  array['image/jpeg','image/png','image/webp','video/webm','video/mp4'])
on conflict (id) do update set public = false, file_size_limit = 26214400,
  allowed_mime_types = excluded.allowed_mime_types;
