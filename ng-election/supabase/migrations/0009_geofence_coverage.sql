-- 0009: staff-only coverage summary. ADDITIVE ONLY. Requires 0001, 0003.
-- Aggregate counts only (no coordinates). A function (not a view) so scope is checked once, not per row of 176k units.
create function geofence_coverage() returns table (
  state_id uuid, state_name text, total bigint, with_coordinates bigint, verified bigint, geofence_ready bigint,
  pending bigint, geocoded_unverified bigint, low_confidence bigint, failed bigint, conflicting bigint, needs_manual bigint)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, count(*),
    count(*) filter (where pu.latitude is not null),
    count(*) filter (where pu.geocode_status = 'verified'),
    count(*) filter (where pu.geocode_status = 'verified' and pu.latitude is not null),
    count(*) filter (where pu.geocode_status = 'pending'),
    count(*) filter (where pu.geocode_status = 'geocoded_unverified'),
    count(*) filter (where pu.geocode_status = 'low_confidence'),
    count(*) filter (where pu.geocode_status = 'failed'),
    count(*) filter (where pu.geocode_status = 'conflicting'),
    count(*) filter (where pu.geocode_status = 'needs_manual_correction')
  from polling_units pu join wards w on w.id = pu.ward_id join lgas l on l.id = w.lga_id join states s on s.id = l.state_id
  where exists (select 1 from user_roles ur where ur.user_id = auth.uid()
    and ur.role in ('supervisor','lga_coordinator','state_admin','election_admin','super_admin')
    and (ur.role in ('super_admin','election_admin') or ur.state_id = s.id))
  group by s.id, s.name order by s.name
$$;
revoke all on function geofence_coverage from public; grant execute on function geofence_coverage to authenticated;
