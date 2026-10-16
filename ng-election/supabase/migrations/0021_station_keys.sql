-- 0021: keys for situation-room laptops. Each laptop is an independent app that only READS data from here.
-- Only a hash is stored; the key itself is shown once at creation. Requires 0003.
create table station_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 2 and 60),
  key_hash text not null unique,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  revoked_at timestamptz, revoked_by uuid references auth.users(id),
  last_seen_at timestamptz                    -- written by the server (service role) when the laptop fetches the feed
);
alter table station_keys enable row level security;
create policy admin_read on station_keys for select using (has_role('election_admin') or has_role('super_admin'));
create policy admin_create on station_keys for insert with check (created_by = auth.uid() and (has_role('election_admin') or has_role('super_admin')));
create policy admin_revoke on station_keys for update using (has_role('election_admin') or has_role('super_admin')) with check (has_role('election_admin') or has_role('super_admin'));
revoke update on station_keys from anon, authenticated; grant update (revoked_at, revoked_by) on station_keys to authenticated;
create trigger audit_station_keys after insert or update on station_keys for each row execute function audit_row();
