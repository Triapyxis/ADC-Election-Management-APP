-- 0011: public LGA/ward/unit result summaries. ADDITIVE ONLY. Requires 0001, 0002.
-- security definer so anon can read ONLY these aggregates; polling_units itself stays closed. No coordinates returned.
-- Perf note: scans per call; fine per-LGA/ward, consider caching or materializing for Election Day.
create function public_lga_summary(p_contest uuid, p_state uuid)
returns table (lga_id uuid, lga_name text, expected bigint, reporting bigint) language sql stable security definer set search_path = public as $$
  select l.id, l.name, count(distinct pu.id), count(distinct s.polling_unit_id) filter (where s.status in ('verified','declared'))
  from lgas l join wards w on w.lga_id = l.id join polling_units pu on pu.ward_id = w.id
  left join result_submissions s on s.polling_unit_id = pu.id and s.contest_id = p_contest
  where l.state_id = p_state and exists (select 1 from contests c join elections e on e.id = c.election_id where c.id = p_contest and e.is_public)
  group by l.id, l.name order by l.name $$;

create function public_ward_summary(p_contest uuid, p_lga uuid)
returns table (ward_id uuid, ward_name text, expected bigint, reporting bigint) language sql stable security definer set search_path = public as $$
  select w.id, w.name, count(distinct pu.id), count(distinct s.polling_unit_id) filter (where s.status in ('verified','declared'))
  from wards w join polling_units pu on pu.ward_id = w.id
  left join result_submissions s on s.polling_unit_id = pu.id and s.contest_id = p_contest
  where w.lga_id = p_lga and exists (select 1 from contests c join elections e on e.id = c.election_id where c.id = p_contest and e.is_public)
  group by w.id, w.name order by w.name $$;

create function public_unit_results(p_contest uuid, p_ward uuid)
returns table (pu_id uuid, official_code text, pu_name text, candidate_id uuid, votes bigint) language sql stable security definer set search_path = public as $$
  select pu.id, pu.official_code, pu.name, v.candidate_id, v.votes::bigint
  from polling_units pu
  left join result_submissions s on s.polling_unit_id = pu.id and s.contest_id = p_contest and s.status in ('verified','declared')
    and not exists (select 1 from result_submissions n where n.supersedes_id = s.id and n.status in ('verified','declared'))
  left join candidate_votes v on v.submission_id = s.id
  where pu.ward_id = p_ward and exists (select 1 from contests c join elections e on e.id = c.election_id where c.id = p_contest and e.is_public)
  order by pu.official_code $$;

grant execute on function public_lga_summary, public_ward_summary, public_unit_results to anon, authenticated;
