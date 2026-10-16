-- 0002: elections, parties, candidates, result submissions, audit, public aggregate views.
-- ADDITIVE ONLY. Requires 0001.
create type contest_type as enum ('presidential','governorship','senatorial','house_of_reps','state_assembly');
create type result_status as enum ('draft','submitted','pending_verification','verified','rejected','corrected','declared');

create table parties (
  id uuid primary key default gen_random_uuid(),
  abbreviation text not null unique, name text not null,
  logo_url text, brand_colour text check (brand_colour ~ '^#[0-9a-fA-F]{6}$')
);
create table elections (
  id uuid primary key default gen_random_uuid(),
  name text not null, election_date date not null,
  status text not null default 'upcoming' check (status in ('upcoming','live','concluded')),
  is_public boolean not null default false
);
create table contests (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  type contest_type not null, name text not null,
  state_id uuid references states(id),
  senatorial_district_id uuid references senatorial_districts(id),
  federal_constituency_id uuid references federal_constituencies(id)
);
create table candidates (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references contests(id),
  party_id uuid not null references parties(id),
  full_name text not null, photo_url text,
  unique (contest_id, party_id)
);
create table result_submissions (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references contests(id),
  polling_unit_id uuid not null references polling_units(id),
  submitted_by uuid references auth.users(id),
  status result_status not null default 'submitted',
  supersedes_id uuid references result_submissions(id), -- corrections add rows; originals are never overwritten
  idempotency_key text unique,
  geofence_status text not null default 'not_checked',   -- location compliance, independent of status
  device_time timestamptz, created_at timestamptz not null default now()
);
create table candidate_votes (
  submission_id uuid not null references result_submissions(id),
  candidate_id uuid not null references candidates(id),
  votes integer not null check (votes >= 0),
  primary key (submission_id, candidate_id)
);
create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid, action text not null, entity text not null, entity_id uuid,
  detail jsonb not null default '{}', at timestamptz not null default now()
);
create index on result_submissions (contest_id, status);
create index on result_submissions (polling_unit_id);

-- Only verified/declared, non-superseded submissions count. Missing rows = unreported, never zero.
create view public_state_votes as
select s.contest_id, w_l.state_id, v.candidate_id, sum(v.votes)::bigint as votes,
       max(s.created_at) as latest_submission_at
from result_submissions s
join candidate_votes v on v.submission_id = s.id
join polling_units pu on pu.id = s.polling_unit_id
join wards w on w.id = pu.ward_id
join lgas w_l on w_l.id = w.lga_id
where s.status in ('verified','declared')
  and not exists (select 1 from result_submissions n where n.supersedes_id = s.id and n.status in ('verified','declared'))
group by s.contest_id, w_l.state_id, v.candidate_id;

create view public_contest_progress as
select c.id as contest_id,
  (select count(*) from polling_units pu join wards w on w.id=pu.ward_id join lgas l on l.id=w.lga_id
    where c.state_id is null or l.state_id = c.state_id) as expected_units,
  (select count(distinct s.polling_unit_id) from result_submissions s where s.contest_id=c.id and s.status in ('verified','declared')) as reporting_units,
  (select count(*) from result_submissions s where s.contest_id=c.id and s.status in ('submitted','pending_verification')) as pending,
  (select count(*) from result_submissions s where s.contest_id=c.id and s.status = 'rejected') as rejected
from contests c;

alter table parties enable row level security; alter table elections enable row level security;
alter table contests enable row level security; alter table candidates enable row level security;
alter table result_submissions enable row level security; alter table candidate_votes enable row level security;
alter table audit_log enable row level security;
create policy public_read on parties for select using (true);
create policy public_read on candidates for select using (true);
create policy public_read on elections for select using (is_public);
create policy public_read on contests for select using (exists (select 1 from elections e where e.id=election_id and e.is_public));
grant select on public_state_votes, public_contest_progress to anon, authenticated;
-- Submissions, votes and audit_log stay closed until roles/policies (0003).
