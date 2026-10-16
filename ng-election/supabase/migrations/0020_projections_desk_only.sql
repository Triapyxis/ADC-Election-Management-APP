-- 0020: projections are NOT public. They are visible only to signed-in broadcast operators and election/super admins. Requires 0018, 0019.
drop view if exists public_projections;                       -- the public tracker never shows estimates

-- broadcast_operator is a national role (no state), like the admins.
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid = 'user_roles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%state_id is not null%';
  if c is not null then execute format('alter table user_roles drop constraint %I', c); end if;
end $$;
alter table user_roles add constraint user_roles_scope_check check (role in ('super_admin','election_admin','broadcast_operator') or state_id is not null);

-- Operators read only RELEASED projections (published = released to the desk).
create policy operator_read_released on projections for select using (published and has_role('broadcast_operator'));
