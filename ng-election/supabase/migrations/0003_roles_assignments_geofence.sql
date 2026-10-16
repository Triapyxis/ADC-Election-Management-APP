-- 0003: roles, scoped permissions, agent assignments, geofence evidence, overrides, audit triggers.
-- ADDITIVE ONLY. Requires 0001, 0002. Public viewer = unauthenticated (anon); no row needed.
create type app_role as enum ('super_admin','election_admin','state_admin','lga_coordinator','supervisor','field_agent','verifier');

create table user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  state_id uuid references states(id),   -- scope; null = national (admins only)
  lga_id uuid references lgas(id),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role),
  check (role in ('super_admin','election_admin') or state_id is not null)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id),
  polling_unit_id uuid not null references polling_units(id),
  starts_at timestamptz not null, expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','revoked')),
  approved_by uuid not null references auth.users(id),  -- agents can never self-assign
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create index on assignments (agent_id, polling_unit_id);

-- Location evidence. Written ONLY by the server (service role) after server-side evaluation.
create table geofence_checks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id),
  assignment_id uuid references assignments(id),
  polling_unit_id uuid not null references polling_units(id),
  trigger text not null check (trigger in ('open','periodic','submission')),
  reported_lat double precision, reported_lon double precision, reported_accuracy_m double precision,
  location_time timestamptz, received_at timestamptz not null default now(),
  distance_m double precision,   -- computed server-side
  outcome text not null check (outcome in ('within_radius','outside_radius','poor_accuracy','gps_missing','stale_location','pu_coordinates_unverified','pu_coordinates_missing','pending_offline_validation')),
  submission_id uuid references result_submissions(id),
  device_time timestamptz, idempotency_key text unique
);
create index on geofence_checks (polling_unit_id, received_at desc);

create table geofence_overrides (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references geofence_checks(id),
  supervisor_id uuid not null references auth.users(id),
  reason text not null check (char_length(btrim(reason)) >= 10),  -- mandatory, meaningful
  created_at timestamptz not null default now()
);

-- Helpers. security definer + fixed search_path so policies can read user_roles safely.
create function has_role(r app_role) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from user_roles where user_id = auth.uid() and role = r) $$;

create function in_scope(pu uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from user_roles ur, polling_units p, wards w, lgas l
  where ur.user_id = auth.uid() and p.id = pu and w.id = p.ward_id and l.id = w.lga_id
    and ( ur.role in ('super_admin','election_admin')
       or (ur.state_id = l.state_id and (ur.lga_id is null or ur.lga_id = l.id)) )
) $$;

create function has_active_assignment(pu uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from assignments where agent_id = auth.uid() and polling_unit_id = pu
  and status = 'active' and now() between starts_at and expires_at) $$;

alter table user_roles enable row level security; alter table assignments enable row level security;
alter table geofence_checks enable row level security; alter table geofence_overrides enable row level security;

create policy own_roles on user_roles for select using (user_id = auth.uid() or has_role('super_admin'));
create policy super_manage_roles on user_roles for all using (has_role('super_admin')) with check (has_role('super_admin'));

create policy own_or_scoped on assignments for select using (agent_id = auth.uid() or in_scope(polling_unit_id));
create policy staff_assign on assignments for insert with check (
  in_scope(polling_unit_id) and approved_by = auth.uid()
  and (has_role('supervisor') or has_role('lga_coordinator') or has_role('state_admin') or has_role('election_admin') or has_role('super_admin')));
create policy staff_update_assign on assignments for update using (in_scope(polling_unit_id) and not has_role('field_agent')) with check (in_scope(polling_unit_id));

-- geofence_checks: read-only to clients. Agents see their own; scoped staff see their area. No client inserts.
create policy own_or_scoped on geofence_checks for select using (agent_id = auth.uid() or in_scope(polling_unit_id));
create policy supervisor_override on geofence_overrides for insert with check (
  supervisor_id = auth.uid() and has_role('supervisor')
  and exists (select 1 from geofence_checks c where c.id = check_id and in_scope(c.polling_unit_id)));
create policy scoped_read on geofence_overrides for select using (exists (select 1 from geofence_checks c where c.id = check_id and in_scope(c.polling_unit_id)));

-- Result submissions: agents insert only for a PU with an active assignment. Status is forced to 'submitted'.
create policy agent_insert on result_submissions for insert with check (
  submitted_by = auth.uid() and status = 'submitted' and has_role('field_agent') and has_active_assignment(polling_unit_id));
create policy own_or_scoped_read on result_submissions for select using (submitted_by = auth.uid() or in_scope(polling_unit_id));
create policy verifier_decide on result_submissions for update using (has_role('verifier') and in_scope(polling_unit_id))
  with check (status in ('verified','rejected','pending_verification'));
create policy agent_votes_insert on candidate_votes for insert with check (
  exists (select 1 from result_submissions s where s.id = submission_id and s.submitted_by = auth.uid() and s.status = 'submitted'));
create policy votes_read on candidate_votes for select using (exists (select 1 from result_submissions s where s.id = submission_id and (s.submitted_by = auth.uid() or in_scope(s.polling_unit_id))));
-- NOTE: 'declared' is deliberately not reachable by any client policy; declarations go through a server-only path.

create function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(actor, action, entity, entity_id, detail)
  values (auth.uid(), tg_op, tg_table_name, (to_jsonb(coalesce(new, old))->>'id')::uuid,
          jsonb_build_object('old', case when tg_op <> 'INSERT' then to_jsonb(old) end, 'new', case when tg_op <> 'DELETE' then to_jsonb(new) end));
  return coalesce(new, old);
end $$;
create trigger audit_assignments after insert or update or delete on assignments for each row execute function audit_row();
create trigger audit_overrides after insert on geofence_overrides for each row execute function audit_row();
create trigger audit_submissions after update on result_submissions for each row execute function audit_row();
-- user_roles has no id column; role changes are audited via a dedicated trigger in a later migration.
