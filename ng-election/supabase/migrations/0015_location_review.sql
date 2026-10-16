-- 0015: human verification/correction of polling-unit locations, with history. Requires 0001, 0003, 0004.
create table location_reviews (
  id uuid primary key default gen_random_uuid(),
  polling_unit_id uuid not null references polling_units(id),
  reviewer uuid not null references auth.users(id),
  old_lat double precision, old_lon double precision, old_status geocode_status,
  new_lat double precision, new_lon double precision, new_status geocode_status not null,
  note text not null check (char_length(btrim(note)) >= 10),
  reviewed_at timestamptz not null default now()
);
alter table location_reviews enable row level security;
create policy staff_read on location_reviews for select using (in_scope(polling_unit_id));
create policy staff_insert on location_reviews for insert with check (
  reviewer = auth.uid() and in_scope(polling_unit_id) and (has_role('state_admin') or has_role('election_admin') or has_role('super_admin')));

-- Only these roles may change location columns, and only these columns.
create policy staff_review on polling_units for update
  using (in_scope(id) and (has_role('state_admin') or has_role('election_admin') or has_role('super_admin')))
  with check (in_scope(id) and (has_role('state_admin') or has_role('election_admin') or has_role('super_admin')));
revoke update on polling_units from anon, authenticated;
grant update (latitude, longitude, geocode_status, updated_at) on polling_units to authenticated;

-- One transaction: history row + update, under the caller's RLS. 'verified' requires in-Nigeria coordinates and a note.
create function set_pu_location(p_pu uuid, p_lat double precision, p_lon double precision, p_status geocode_status, p_note text)
returns void language plpgsql security invoker set search_path = public as $$
declare o polling_units; n int;
begin
  select * into o from polling_units where id = p_pu;
  if not found then raise exception 'polling unit not found or no access'; end if;
  if p_status not in ('verified','needs_manual_correction') then raise exception 'status must be verified or needs_manual_correction'; end if;
  if p_status = 'verified' and (p_lat is null or p_lon is null or p_lat not between 4.0 and 14.0 or p_lon not between 2.5 and 14.8)
    then raise exception 'verified requires coordinates inside Nigeria'; end if;
  insert into location_reviews(polling_unit_id, reviewer, old_lat, old_lon, old_status, new_lat, new_lon, new_status, note)
  values (p_pu, auth.uid(), o.latitude, o.longitude, o.geocode_status, case when p_status = 'verified' then p_lat else o.latitude end,
          case when p_status = 'verified' then p_lon else o.longitude end, p_status, p_note);
  update polling_units set latitude = case when p_status = 'verified' then p_lat else latitude end,
    longitude = case when p_status = 'verified' then p_lon else longitude end, geocode_status = p_status, updated_at = now() where id = p_pu;
  get diagnostics n = row_count; if n = 0 then raise exception 'not permitted'; end if;
end $$;
revoke all on function set_pu_location from public; grant execute on function set_pu_location to authenticated;
