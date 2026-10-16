-- 0001: geography hierarchy, polling units, import history.
-- ADDITIVE ONLY. No DROP/TRUNCATE/DELETE. Safe to review before applying.
-- Reversal: supabase/migrations/0001_rollback.sql (drops only objects created here).

create extension if not exists pgcrypto;

create type geocode_status as enum (
  'pending','geocoded_unverified','verified','low_confidence',
  'failed','conflicting','needs_manual_correction'
);

-- Official INEC codes are TEXT: leading zeros are significant ("01", "033").
create table states (
  id uuid primary key default gen_random_uuid(),
  inec_code text not null unique check (inec_code ~ '^[0-9]{2}$'),
  name text not null unique,
  is_fct boolean not null default false
);

create table senatorial_districts (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states(id),
  name text not null,
  unique (state_id, name)
);

create table federal_constituencies (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states(id),
  name text not null,
  unique (state_id, name)
);

create table lgas (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states(id),
  inec_code text not null check (inec_code ~ '^[0-9]{2}$'),
  name text not null,
  unique (state_id, inec_code)
);

create table wards (
  id uuid primary key default gen_random_uuid(),
  lga_id uuid not null references lgas(id),
  inec_code text not null check (inec_code ~ '^[0-9]{2}$'),
  name text not null,
  unique (lga_id, inec_code)
);

create table polling_units (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references wards(id),
  inec_pu_code text not null check (inec_pu_code ~ '^[0-9]{3}$'),
  official_code text not null unique check (official_code ~ '^[0-9]{2}/[0-9]{2}/[0-9]{2}/[0-9]{3}$'),
  name text not null,                 -- cleaned display text
  source_location text not null,      -- verbatim CSV value, never altered
  senatorial_district_id uuid references senatorial_districts(id),
  federal_constituency_id uuid references federal_constituencies(id),
  data_quality_flags text[] not null default '{}',
  -- Coordinates come ONLY from the geocoding/verification workflow, never from the CSV.
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  geocode_status geocode_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ward_id, inec_pu_code),
  check ((latitude is null) = (longitude is null))
);
create index polling_units_ward_idx on polling_units (ward_id);
create index polling_units_geocode_idx on polling_units (geocode_status);
create index lgas_state_idx on lgas (state_id);
create index wards_lga_idx on wards (lga_id);

create table import_runs (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  source_sha256 text not null,
  mode text not null check (mode in ('preview','apply')),
  status text not null check (status in ('running','completed','failed')),
  counts jsonb not null default '{}',
  issues jsonb not null default '[]',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- RLS: on from day one. Geography is public reference data; everything else is closed
-- until roles/policies land in migration 0003. Writes happen only via service role.
alter table states enable row level security;
alter table senatorial_districts enable row level security;
alter table federal_constituencies enable row level security;
alter table lgas enable row level security;
alter table wards enable row level security;
alter table polling_units enable row level security;
alter table import_runs enable row level security;

create policy public_read on states for select using (true);
create policy public_read on senatorial_districts for select using (true);
create policy public_read on federal_constituencies for select using (true);
create policy public_read on lgas for select using (true);
create policy public_read on wards for select using (true);
-- polling_units and import_runs: no policy yet = no client access (service role only).
-- Public PU access will go through a view without coordinates once roles exist.
