-- 0012: scope expected units to the contest's own area; public per-contest leaders. Requires 0001, 0002.
-- Replaces the view from 0002 (same columns/types). State House of Assembly constituencies are NOT in the CSV,
-- so assembly contests fall back to state scope until that boundary data is sourced.
create or replace view public_contest_progress as
select c.id as contest_id,
  (select count(*) from polling_units pu join wards w on w.id = pu.ward_id join lgas l on l.id = w.lga_id
    where case when c.senatorial_district_id is not null then pu.senatorial_district_id = c.senatorial_district_id
               when c.federal_constituency_id is not null then pu.federal_constituency_id = c.federal_constituency_id
               when c.state_id is not null then l.state_id = c.state_id
               else true end) as expected_units,
  (select count(distinct s.polling_unit_id) from result_submissions s where s.contest_id = c.id and s.status in ('verified','declared')) as reporting_units,
  (select count(*) from result_submissions s where s.contest_id = c.id and s.status in ('submitted','pending_verification')) as pending,
  (select count(*) from result_submissions s where s.contest_id = c.id and s.status = 'rejected') as rejected
from contests c;

-- Leader per contest from verified votes. margin = lead over runner-up; margin 0 means a TIE (not a lead).
-- This is "leading", never "declared": declarations are a separate, server-only step.
create view public_contest_leaders as
with agg as (
  select s.contest_id, v.candidate_id, sum(v.votes)::bigint votes
  from result_submissions s join candidate_votes v on v.submission_id = s.id
  where s.status in ('verified','declared')
    and not exists (select 1 from result_submissions n where n.supersedes_id = s.id and n.status in ('verified','declared'))
  group by s.contest_id, v.candidate_id),
ranked as (
  select agg.*, row_number() over (partition by contest_id order by votes desc, candidate_id) rn,
         votes - lead(votes) over (partition by contest_id order by votes desc, candidate_id) as gap from agg)
select r.contest_id, c.type, c.state_id, r.candidate_id, cand.party_id, p.abbreviation as party, p.brand_colour, r.votes, coalesce(r.gap, r.votes) as margin
from ranked r join contests c on c.id = r.contest_id join elections e on e.id = c.election_id and e.is_public
join candidates cand on cand.id = r.candidate_id join parties p on p.id = cand.party_id
where r.rn = 1;
grant select on public_contest_leaders to anon, authenticated;
