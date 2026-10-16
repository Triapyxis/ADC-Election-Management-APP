-- 0017: SECURITY FIX + agent roster. Requires 0003.
-- BUG in 0003: in_scope() matched ANY role with a state, including field_agent. Because agents carry a state,
-- every policy using in_scope() would have let an agent read all submissions, assignments, location checks and
-- documents in their state. Fix: field agents are never "in scope" of other people's data.
create or replace function in_scope(pu uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from user_roles ur, polling_units p, wards w, lgas l
  where ur.user_id = auth.uid() and ur.role <> 'field_agent'
    and p.id = pu and w.id = p.ward_id and l.id = w.lga_id
    and ( ur.role in ('super_admin','election_admin')
       or (ur.state_id = l.state_id and (ur.lga_id is null or ur.lga_id = l.id)) )
) $$;

-- Staff may change only an assignment's status (revoke); who/where/when can never be edited in place.
revoke update on assignments from anon, authenticated;
grant update (status) on assignments to authenticated;

-- Roster: agents with assignments in the caller's scope, with activity counts. Staff only. Includes email (PII): staff in scope only.
create function staff_agent_roster() returns table (
  agent_id uuid, email text, active_assignments bigint, last_check_at timestamptz, last_outcome text,
  submissions bigint, verified bigint, rejected bigint, pending bigint, flagged_checks bigint)
language sql stable security definer set search_path = public, auth as $$
  with caller_ok as (select 1 where exists (select 1 from user_roles where user_id = auth.uid()
    and role in ('supervisor','lga_coordinator','state_admin','election_admin','super_admin'))),
  agents as (select distinct a.agent_id from assignments a, caller_ok where in_scope(a.polling_unit_id))
  select g.agent_id, u.email::text,
    (select count(*) from assignments a where a.agent_id = g.agent_id and a.status = 'active' and now() between a.starts_at and a.expires_at and in_scope(a.polling_unit_id)),
    lc.received_at, lc.outcome,
    (select count(*) from result_submissions s where s.submitted_by = g.agent_id and in_scope(s.polling_unit_id)),
    (select count(*) from result_submissions s where s.submitted_by = g.agent_id and s.status in ('verified','declared') and in_scope(s.polling_unit_id)),
    (select count(*) from result_submissions s where s.submitted_by = g.agent_id and s.status = 'rejected' and in_scope(s.polling_unit_id)),
    (select count(*) from result_submissions s where s.submitted_by = g.agent_id and s.status in ('submitted','pending_verification') and in_scope(s.polling_unit_id)),
    (select count(*) from geofence_checks c where c.agent_id = g.agent_id and c.outcome <> 'within_radius' and in_scope(c.polling_unit_id))
  from agents g join auth.users u on u.id = g.agent_id
  left join lateral (select c.received_at, c.outcome from geofence_checks c where c.agent_id = g.agent_id and in_scope(c.polling_unit_id) order by c.received_at desc limit 1) lc on true
  order by u.email
$$;
revoke all on function staff_agent_roster from public; grant execute on function staff_agent_roster to authenticated;
