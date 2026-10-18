-- Per-election, per-contest-type agent access windows and manual locks.
-- Additive migration: existing results and users are not changed.

create table election_agent_access (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id) on delete cascade,
  contest_type contest_type not null,
  access_mode text not null default 'locked' check (access_mode in ('scheduled','open','locked')),
  opens_at timestamptz,
  closes_at timestamptz,
  reason text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (election_id, contest_type),
  check (opens_at is null or closes_at is null or closes_at > opens_at),
  check (reason is null or char_length(reason) <= 500)
);

create index election_agent_access_window_idx on election_agent_access (election_id, contest_type, opens_at, closes_at);
alter table election_agent_access enable row level security;

create policy election_access_admin_read on election_agent_access for select to authenticated
  using (has_role('super_admin') or has_role('election_admin'));
-- Agents may read the schedule/status to display a lock screen; they cannot change it.
create policy election_access_agent_read on election_agent_access for select to authenticated
  using (has_role('field_agent'));
create policy election_access_admin_insert on election_agent_access for insert to authenticated
  with check ((has_role('super_admin') or has_role('election_admin')) and updated_by = auth.uid());
create policy election_access_admin_update on election_agent_access for update to authenticated
  using (has_role('super_admin') or has_role('election_admin'))
  with check ((has_role('super_admin') or has_role('election_admin')) and updated_by = auth.uid());

create or replace function election_agent_access_is_open(p_contest uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from contests c
    join election_agent_access a on a.election_id = c.election_id and a.contest_type = c.type
    where c.id = p_contest
      and (
        a.access_mode = 'open'
        or (a.access_mode = 'scheduled' and a.opens_at is not null and a.closes_at is not null
            and now() >= a.opens_at and now() < a.closes_at)
      )
  );
$$;
revoke all on function election_agent_access_is_open(uuid) from public, anon;
grant execute on function election_agent_access_is_open(uuid) to authenticated;

-- Enforce locks in RLS as well as in the user interface/API. A missing control row means locked.
drop policy if exists agent_insert on result_submissions;
create policy agent_insert on result_submissions for insert with check (
  submitted_by = auth.uid() and status = 'submitted' and geofence_status = 'not_checked'
  and has_role('field_agent') and has_active_assignment(polling_unit_id)
  and election_agent_access_is_open(contest_id)
);

drop policy if exists agent_votes_insert on candidate_votes;
create policy agent_votes_insert on candidate_votes for insert with check (
  exists (select 1 from result_submissions s where s.id = submission_id
    and s.submitted_by = auth.uid() and s.status = 'submitted'
    and election_agent_access_is_open(s.contest_id))
);

create or replace function submit_result(p_contest uuid, p_pu uuid, p_key text, p_device_time timestamptz, p_votes jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare sid uuid;
begin
  if not election_agent_access_is_open(p_contest) then
    raise exception 'Agent access is closed for this election type.' using errcode = 'P0001';
  end if;
  insert into result_submissions(contest_id, polling_unit_id, submitted_by, status, idempotency_key, device_time)
  values (p_contest, p_pu, auth.uid(), 'submitted', p_key, p_device_time) returning id into sid;
  insert into candidate_votes(submission_id, candidate_id, votes)
  select sid, (e->>'candidateId')::uuid, (e->>'votes')::int from jsonb_array_elements(p_votes) e;
  return sid;
end $$;
revoke all on function submit_result from public; grant execute on function submit_result to authenticated;

create or replace function submit_correction(p_original uuid, p_key text, p_device_time timestamptz, p_votes jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare o result_submissions; sid uuid;
begin
  select * into o from result_submissions where id = p_original and submitted_by = auth.uid();
  if not found then raise exception 'original not found or not yours'; end if;
  if o.status = 'declared' then raise exception 'declared results cannot be corrected here'; end if;
  if not election_agent_access_is_open(o.contest_id) then
    raise exception 'Agent access is closed for this election type.' using errcode = 'P0001';
  end if;
  insert into result_submissions(contest_id, polling_unit_id, submitted_by, status, supersedes_id, idempotency_key, device_time)
  values (o.contest_id, o.polling_unit_id, auth.uid(), 'submitted', o.id, p_key, p_device_time) returning id into sid;
  insert into candidate_votes(submission_id, candidate_id, votes)
  select sid, (e->>'candidateId')::uuid, (e->>'votes')::int from jsonb_array_elements(p_votes) e;
  return sid;
end $$;
revoke all on function submit_correction from public; grant execute on function submit_correction to authenticated;

-- Audit every access-control change. Trigger function runs with database-owner rights only to write audit evidence.
create or replace function audit_election_agent_access_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(actor, action, entity, entity_id, detail)
  values (auth.uid(), case when tg_op = 'INSERT' then 'election_agent_access_created' else 'election_agent_access_updated' end,
    'election_agent_access', new.id,
    jsonb_build_object('election_id', new.election_id, 'contest_type', new.contest_type,
      'access_mode', new.access_mode, 'opens_at', new.opens_at, 'closes_at', new.closes_at,
      'reason', new.reason));
  return new;
end $$;
create trigger audit_election_agent_access_change
  after insert or update on election_agent_access
  for each row execute function audit_election_agent_access_change();
