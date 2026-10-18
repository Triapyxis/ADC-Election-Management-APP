-- One-time pairing codes for Situation Room stations. Requires 0021 and 0022.
create table station_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 2 and 60),
  code_hash text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  check (expires_at > created_at)
);
alter table station_pairing_codes enable row level security;
-- No client policies: only server-side service-role operations can read or consume pairing-code hashes.

-- Station Systems Administrators are national-scope, but have no other election privileges.
alter table user_roles drop constraint if exists user_roles_scope_check;
alter table user_roles add constraint user_roles_scope_check check (role in ('super_admin','election_admin','broadcast_operator','station_system_admin') or state_id is not null);

drop policy if exists admin_read on station_keys;
drop policy if exists admin_create on station_keys;
drop policy if exists admin_revoke on station_keys;
create policy station_managers_read on station_keys for select using (has_role('election_admin') or has_role('super_admin') or has_role('station_system_admin'));
create policy station_managers_create on station_keys for insert with check (created_by = auth.uid() and (has_role('election_admin') or has_role('super_admin') or has_role('station_system_admin')));
create policy station_managers_revoke on station_keys for update using (has_role('election_admin') or has_role('super_admin') or has_role('station_system_admin')) with check (has_role('election_admin') or has_role('super_admin') or has_role('station_system_admin'));

create or replace function consume_station_pairing_code(p_code_hash text)
returns table(pairing_id uuid, station_label text, creator_id uuid)
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  select c.id into v_id from station_pairing_codes c
    where c.code_hash = p_code_hash and c.used_at is null and c.expires_at > now()
    for update skip locked limit 1;
  if v_id is null then return; end if;
  update station_pairing_codes c set used_at = now()
    where c.id = v_id and c.used_at is null and c.expires_at > now();
  if not found then return; end if;
  return query select c.id, c.label, c.created_by from station_pairing_codes c where c.id = v_id;
end;
$$;
revoke all on function consume_station_pairing_code(text) from public, anon, authenticated;
grant execute on function consume_station_pairing_code(text) to service_role;
