-- 0004: geocoding attempt history. ADDITIVE ONLY. Requires 0001.
create table geocode_attempts (
  id uuid primary key default gen_random_uuid(),
  polling_unit_id uuid not null references polling_units(id),
  provider text not null, query text not null,
  outcome text not null check (outcome in ('geocoded_unverified','low_confidence','failed','conflicting')),
  reason text, latitude double precision, longitude double precision, confidence double precision,
  attempted_at timestamptz not null default now()
);
create index on geocode_attempts (polling_unit_id, attempted_at desc);
alter table geocode_attempts enable row level security;  -- service role only until roles policy added
