-- 0005: per-state reporting progress for public pages. ADDITIVE ONLY. Requires 0001, 0002.
-- Perf note: scans polling_units per contest; convert to a materialized view if Election Day load needs it.
create view public_state_progress as
select c.id as contest_id, l.state_id,
       count(distinct pu.id) as expected_units,
       count(distinct s.polling_unit_id) filter (where s.status in ('verified','declared')) as reporting_units
from contests c
join lgas l on (c.state_id is null or c.state_id = l.state_id)
join wards w on w.lga_id = l.id
join polling_units pu on pu.ward_id = w.id
left join result_submissions s on s.polling_unit_id = pu.id and s.contest_id = c.id
group by c.id, l.state_id;
grant select on public_state_progress to anon, authenticated;
