-- 0028: structured audit metadata for polling-unit result-sheet and incident camera evidence.
-- Additive only. Existing evidence and records are preserved; legacy rows remain marked by defaults/nulls.

-- Result-sheet evidence metadata. Agent, polling unit and contest remain linked through
-- submission_documents -> result_submissions -> polling_units/contests; these fields preserve
-- the capture-time location checks and the server's receipt time alongside the evidence hash.
alter table submission_documents add column if not exists client_captured_at timestamptz;
alter table submission_documents add column if not exists server_received_at timestamptz not null default now();
alter table submission_documents add column if not exists initial_lat double precision;
alter table submission_documents add column if not exists initial_lon double precision;
alter table submission_documents add column if not exists initial_accuracy_m double precision;
alter table submission_documents add column if not exists initial_location_time timestamptz;
alter table submission_documents add column if not exists initial_distance_m double precision;
alter table submission_documents add column if not exists reported_lat double precision;
alter table submission_documents add column if not exists reported_lon double precision;
alter table submission_documents add column if not exists reported_accuracy_m double precision;
alter table submission_documents add column if not exists location_time timestamptz;
alter table submission_documents add column if not exists distance_m double precision;
alter table submission_documents add column if not exists geofence_outcome text;
alter table submission_documents add column if not exists device_metadata jsonb not null default '{}'::jsonb;
alter table submission_documents add column if not exists evidence_metadata jsonb not null default '{}'::jsonb;

-- Persist initial/final GPS and device/recording details for polling-unit incident evidence.
alter table polling_incident_capture_sessions add column if not exists initial_geofence_outcome text not null default 'within_radius' check (initial_geofence_outcome = 'within_radius');
alter table polling_incidents add column if not exists capture_session_id uuid references polling_incident_capture_sessions(id) on delete restrict;
alter table polling_incidents add column if not exists initial_lat double precision;
alter table polling_incidents add column if not exists initial_lon double precision;
alter table polling_incidents add column if not exists initial_accuracy_m double precision;
alter table polling_incidents add column if not exists initial_location_time timestamptz;
alter table polling_incidents add column if not exists initial_distance_m double precision;
alter table polling_incidents add column if not exists location_trail jsonb not null default '[]'::jsonb;
alter table polling_incidents add column if not exists recording_started_at timestamptz;
alter table polling_incidents add column if not exists recording_ended_at timestamptz;
alter table polling_incidents add column if not exists recording_duration_seconds integer;
alter table polling_incidents add column if not exists device_metadata jsonb not null default '{}'::jsonb;
alter table polling_incidents add column if not exists evidence_metadata jsonb not null default '{}'::jsonb;

create index if not exists submission_documents_capture_session_idx on submission_documents(capture_session_id);
create index if not exists polling_incidents_capture_session_idx on polling_incidents(capture_session_id);

-- Database-level constraints for new metadata. Nulls remain allowed for historical legacy records.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'submission_documents_geofence_outcome_check') then
    alter table submission_documents add constraint submission_documents_geofence_outcome_check
      check (geofence_outcome is null or geofence_outcome = 'within_radius');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'submission_documents_accuracy_check') then
    alter table submission_documents add constraint submission_documents_accuracy_check
      check ((initial_accuracy_m is null or initial_accuracy_m between 0 and 50)
        and (reported_accuracy_m is null or reported_accuracy_m between 0 and 50));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'polling_incidents_recording_duration_check') then
    alter table polling_incidents add constraint polling_incidents_recording_duration_check
      check (recording_duration_seconds is null or recording_duration_seconds between 0 and 90);
  end if;
end $$;

comment on column submission_documents.client_captured_at is 'Client-reported camera capture time; not authoritative proof of capture time.';
comment on column submission_documents.server_received_at is 'Authoritative server-side time the evidence registration was accepted.';
comment on column submission_documents.device_metadata is 'Supporting client/device diagnostics and server-observed user agent; not trusted as proof of device integrity.';
comment on column polling_incidents.location_trail is 'GPS samples captured during recording or at incident capture, including reported accuracy and client location timestamps.';
comment on column polling_incidents.evidence_metadata is 'Versioned evidence metadata; does not certify authenticity of the camera feed.';


-- Immutable-by-client audit trail for result-sheet evidence registration. Trusted API writes via service role.
create table if not exists submission_document_audit (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references submission_documents(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists submission_document_audit_document_idx on submission_document_audit(document_id, created_at desc);
alter table submission_document_audit enable row level security;
-- No direct client insert/update/delete policies; server-side trusted routes create audit entries.


-- The collation-centre workflow already records core metadata; these fields retain its capture session,
-- initial location, video timeline, GPS trail and supporting device diagnostics consistently.
alter table collation_evidence add column if not exists capture_session_id uuid references collation_capture_sessions(id) on delete restrict;
alter table collation_evidence add column if not exists initial_lat double precision;
alter table collation_evidence add column if not exists initial_lon double precision;
alter table collation_evidence add column if not exists initial_accuracy_m double precision;
alter table collation_evidence add column if not exists initial_location_time timestamptz;
alter table collation_evidence add column if not exists initial_distance_m double precision;
alter table collation_evidence add column if not exists location_trail jsonb not null default '[]'::jsonb;
alter table collation_evidence add column if not exists recording_started_at timestamptz;
alter table collation_evidence add column if not exists recording_ended_at timestamptz;
alter table collation_evidence add column if not exists recording_duration_seconds integer;
alter table collation_evidence add column if not exists device_metadata jsonb not null default '{}'::jsonb;
alter table collation_evidence add column if not exists evidence_metadata jsonb not null default '{}'::jsonb;
create index if not exists collation_evidence_capture_session_idx on collation_evidence(capture_session_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'collation_evidence_recording_duration_check') then
    alter table collation_evidence add constraint collation_evidence_recording_duration_check
      check (recording_duration_seconds is null or recording_duration_seconds between 0 and 90);
  end if;
end $$;
comment on column collation_evidence.device_metadata is 'Supporting device/browser diagnostics; not proof of camera or device integrity.';
comment on column collation_evidence.location_trail is 'GPS samples recorded during capture or video recording.';
