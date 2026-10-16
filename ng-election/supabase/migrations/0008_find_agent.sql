-- 0008: resolve an agent by email for assignment, without exposing auth.users. ADDITIVE ONLY. Requires 0003.
create function find_agent_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select u.id from auth.users u join user_roles r on r.user_id = u.id and r.role = 'field_agent'
  where lower(u.email) = lower(p_email)
    and exists (select 1 from user_roles s where s.user_id = auth.uid()
                and s.role in ('supervisor','lga_coordinator','state_admin','election_admin','super_admin'))
$$;
revoke all on function find_agent_by_email from public; grant execute on function find_agent_by_email to authenticated;
