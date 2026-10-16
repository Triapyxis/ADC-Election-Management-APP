-- DEVELOPMENT / STAGING ONLY. NEVER RUN IN PRODUCTION.
-- Everything here is FICTIONAL test data so the screens can be exercised before real INEC data is loaded.
-- Run AFTER migrations 0001-0010 and the polling-unit import. Re-runnable: it removes only rows it created.
do $$ begin
  if (select count(*) from polling_units) < 1000 then raise exception 'Import polling units first (npm run import:apply).'; end if;
end $$;

delete from candidate_votes where submission_id in (select id from result_submissions where idempotency_key like 'devseed-%');
delete from result_submissions where idempotency_key like 'devseed-%';
delete from candidates where contest_id in (select id from contests where name like 'TEST %');
delete from contests where name like 'TEST %';
delete from elections where name like 'TEST %';
delete from parties where abbreviation like 'TST-%';

insert into parties (abbreviation, name, brand_colour) values
  ('TST-A','Test Party A (fictional)','#1f6f8b'), ('TST-B','Test Party B (fictional)','#b5532a'), ('TST-C','Test Party C (fictional)','#6b5b95');
insert into elections (name, election_date, status, is_public) values ('TEST Presidential Election (fictional data)', current_date, 'live', true);
insert into contests (election_id, type, name) select id, 'presidential', 'TEST Presidential' from elections where name like 'TEST %';
insert into candidates (contest_id, party_id, full_name)
  select c.id, p.id, 'Test Candidate ' || right(p.abbreviation,1) from contests c cross join parties p where c.name like 'TEST %' and p.abbreviation like 'TST-%';

-- Verified results for the first 40 units of 6 states, deterministic fictional votes.
with picked as (
  select pu.id pu_id, row_number() over (partition by l.state_id order by pu.official_code) rn, s.name sname
  from polling_units pu join wards w on w.id = pu.ward_id join lgas l on l.id = w.lga_id join states s on s.id = l.state_id
  where s.name in ('Lagos','Kano','Rivers','Enugu','Kaduna','FCT')
), ins as (
  insert into result_submissions (contest_id, polling_unit_id, status, idempotency_key)
  select (select id from contests where name like 'TEST %'), pu_id, 'verified', 'devseed-' || pu_id from picked where rn <= 40 returning id, idempotency_key
)
insert into candidate_votes (submission_id, candidate_id, votes)
select i.id, c.id, (abs(hashtext(i.idempotency_key || c.full_name)) % 180) + 10 from ins i cross join candidates c
where c.contest_id = (select id from contests where name like 'TEST %');
