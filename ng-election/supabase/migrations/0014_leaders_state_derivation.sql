-- 0014: derive each contest's state from its senatorial district / federal constituency when state_id is unset,
-- so seat maps work however the contest was set up. Same columns/types as 0012. Requires 0012.
create or replace view public_contest_leaders as
with agg as (
  select s.contest_id, v.candidate_id, sum(v.votes)::bigint votes
  from result_submissions s join candidate_votes v on v.submission_id = s.id
  where s.status in ('verified','declared')
    and not exists (select 1 from result_submissions n where n.supersedes_id = s.id and n.status in ('verified','declared'))
  group by s.contest_id, v.candidate_id),
ranked as (
  select agg.*, row_number() over (partition by contest_id order by votes desc, candidate_id) rn,
         votes - lead(votes) over (partition by contest_id order by votes desc, candidate_id) as gap from agg)
select r.contest_id, c.type, coalesce(c.state_id, sd.state_id, fc.state_id) as state_id, r.candidate_id, cand.party_id,
       p.abbreviation as party, p.brand_colour, r.votes, coalesce(r.gap, r.votes) as margin
from ranked r join contests c on c.id = r.contest_id join elections e on e.id = c.election_id and e.is_public
left join senatorial_districts sd on sd.id = c.senatorial_district_id
left join federal_constituencies fc on fc.id = c.federal_constituency_id
join candidates cand on cand.id = r.candidate_id join parties p on p.id = cand.party_id
where r.rn = 1;
