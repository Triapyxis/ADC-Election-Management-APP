-- RLS SMOKE TEST. Run on STAGING in the Supabase SQL editor AFTER migrations 0001-0018 and the polling-unit import.
-- Everything runs inside a transaction that is ROLLED BACK at the end: no data is left behind.
-- Output: one "PASS: ..." notice per check, then "ALL CHECKS PASSED". Any failure stops with "FAIL: <what> (got: <result>)".
-- If the auth.users insert fails in your project, create 5 users in Dashboard > Auth and replace the five uuids below.
begin;

create function pg_temp.q(uid uuid, r text, sql text) returns text language plpgsql as $$
declare out text;
begin
  perform set_config('request.jwt.claims', case when uid is null then '{}' else json_build_object('sub', uid::text, 'role', r)::text end, true);
  begin
    execute 'set local role ' || quote_ident(r);
    execute sql into out;
    reset role;
    return 'ok:' || coalesce(out, '');
  exception when others then
    reset role;
    return 'err:' || sqlerrm;
  end;
end $$;

create function pg_temp.expect(actual text, expected_prefix text, label text) returns void language plpgsql as $$
begin
  if actual like expected_prefix || '%' then raise notice 'PASS: %', label;
  else raise exception 'FAIL: % (got: %)', label, actual; end if;
end $$;

do $$
declare
  a uuid := 'a0000000-0000-0000-0000-000000000001'; b uuid := 'a0000000-0000-0000-0000-000000000002';
  s uuid := 'a0000000-0000-0000-0000-000000000003'; v uuid := 'a0000000-0000-0000-0000-000000000004'; x uuid := 'a0000000-0000-0000-0000-000000000005';
  st uuid; pu1 uuid; pu2 uuid; el uuid; ct uuid; c1 uuid; c2 uuid; p1 uuid; p2 uuid; sub_a uuid; sub_b uuid; sub_v uuid; votes text;
begin
  insert into auth.users (id, email, aud, role) values
    (a,'rls-agent-a@test.local','authenticated','authenticated'), (b,'rls-agent-b@test.local','authenticated','authenticated'),
    (s,'rls-sup@test.local','authenticated','authenticated'), (v,'rls-ver@test.local','authenticated','authenticated'), (x,'rls-none@test.local','authenticated','authenticated');
  select l.state_id into st from lgas l join wards w on w.lga_id = l.id join polling_units p on p.ward_id = w.id limit 1;
  select p.id into pu1 from polling_units p join wards w on w.id = p.ward_id join lgas l on l.id = w.lga_id where l.state_id = st order by p.official_code limit 1;
  select p.id into pu2 from polling_units p join wards w on w.id = p.ward_id join lgas l on l.id = w.lga_id where l.state_id = st order by p.official_code offset 1 limit 1;
  if pu1 is null or pu2 is null then raise exception 'FAIL: import polling units first'; end if;

  insert into user_roles (user_id, role, state_id) values (a,'field_agent',st), (b,'field_agent',st), (s,'supervisor',st), (v,'verifier',st);
  insert into assignments (agent_id, polling_unit_id, starts_at, expires_at, approved_by) values (a, pu1, now() - interval '1 hour', now() + interval '1 day', s);
  insert into elections (name, election_date, status, is_public) values ('RLS TEST', current_date, 'live', true) returning id into el;
  insert into contests (election_id, type, name) values (el,'presidential','RLS TEST CONTEST') returning id into ct;
  insert into parties (abbreviation, name) values ('RLS1','RLS Party 1') returning id into p1;
  insert into parties (abbreviation, name) values ('RLS2','RLS Party 2') returning id into p2;
  insert into candidates (contest_id, party_id, full_name) values (ct,p1,'RLS One') returning id into c1;
  insert into candidates (contest_id, party_id, full_name) values (ct,p2,'RLS Two') returning id into c2;
  votes := format('[{"candidateId":"%s","votes":5},{"candidateId":"%s","votes":3}]', c1, c2);

  -- AGENTS
  perform pg_temp.expect(pg_temp.q(a,'authenticated', format('select submit_result(%L,%L,%L,null,%L::jsonb)::text', ct, pu1, 'k-a-1', votes)), 'ok:', 'assigned agent CAN submit for their unit');
  perform pg_temp.expect(pg_temp.q(b,'authenticated', format('select submit_result(%L,%L,%L,null,%L::jsonb)::text', ct, pu1, 'k-b-1', votes)), 'err:', 'unassigned agent CANNOT submit');
  perform pg_temp.expect(pg_temp.q(a,'authenticated', format('select submit_result(%L,%L,%L,null,%L::jsonb)::text', ct, pu2, 'k-a-2', votes)), 'err:', 'agent CANNOT submit for a unit they are not assigned to');
  select id into sub_a from result_submissions where idempotency_key = 'k-a-1';
  insert into result_submissions (contest_id, polling_unit_id, submitted_by, status, idempotency_key) values (ct, pu2, b, 'submitted', 'k-b-owner') returning id into sub_b;
  perform pg_temp.expect(pg_temp.q(a,'authenticated', format('select count(*)::text from result_submissions where id = %L', sub_b)), 'ok:0', 'agent CANNOT read another agent''s submission in the same state (0017 fix)');
  perform pg_temp.expect(pg_temp.q(a,'authenticated', format('select count(*)::text from assignments where agent_id <> %L', a)), 'ok:0', 'agent sees only their own assignments');
  perform pg_temp.expect(pg_temp.q(a,'authenticated', format('select count(*)::text from polling_units where id = %L', pu2)), 'ok:0', 'agent CANNOT read polling units they are not assigned to');
  perform pg_temp.expect(pg_temp.q(a,'authenticated', format('select count(*)::text from polling_units where id = %L', pu1)), 'ok:1', 'agent CAN read their assigned polling unit');
  perform pg_temp.expect(pg_temp.q(a,'authenticated', format('with i as (insert into result_submissions (contest_id,polling_unit_id,submitted_by,status,geofence_status,idempotency_key) values (%L,%L,%L,''submitted'',''within_radius'',''k-a-fake'') returning 1) select count(*)::text from i', ct, pu1, a)), 'err:', 'agent CANNOT self-report a passing location status');
  perform pg_temp.expect(pg_temp.q(a,'authenticated', format('with i as (insert into assignments (agent_id,polling_unit_id,starts_at,expires_at,approved_by) values (%L,%L,now(),now()+interval ''1 day'',%L) returning 1) select count(*)::text from i', a, pu2, a)), 'err:', 'agent CANNOT assign themselves');
  perform pg_temp.expect(pg_temp.q(a,'authenticated', format('with u as (update result_submissions set status = ''verified'' where id = %L returning 1) select count(*)::text from u', sub_a)), 'err:', 'agent CANNOT verify their own submission (no update privilege)');

  -- SUPERVISOR / VERIFIER
  perform pg_temp.expect(pg_temp.q(s,'authenticated', format('select count(*)::text from result_submissions where id = %L', sub_a)), 'ok:1', 'supervisor in scope CAN read the agent''s submission');
  perform pg_temp.expect(pg_temp.q(s,'authenticated', format('with i as (insert into assignments (agent_id,polling_unit_id,starts_at,expires_at,approved_by) values (%L,%L,now(),now()+interval ''1 day'',%L) returning 1) select count(*)::text from i', b, pu2, s)), 'ok:1', 'supervisor in scope CAN assign an agent');
  perform pg_temp.expect(pg_temp.q(v,'authenticated', format('with u as (update result_submissions set status = ''declared'' where id = %L returning 1) select count(*)::text from u', sub_a)), 'err:', 'verifier CANNOT set status declared');
  perform pg_temp.expect(pg_temp.q(v,'authenticated', format('with u as (update result_submissions set geofence_status = ''within_radius'' where id = %L returning 1) select count(*)::text from u', sub_a)), 'err:', 'verifier CANNOT change the location status column');
  perform pg_temp.expect(pg_temp.q(v,'authenticated', format('with u as (update result_submissions set status = ''rejected'' where id = %L returning 1) select count(*)::text from u', sub_a)), 'err:', 'rejection WITHOUT a note is refused');
  insert into result_submissions (contest_id, polling_unit_id, submitted_by, status, idempotency_key) values (ct, pu1, v, 'submitted', 'k-v-own') returning id into sub_v;
  perform pg_temp.expect(pg_temp.q(v,'authenticated', format('with u as (update result_submissions set status = ''verified'' where id = %L returning 1) select count(*)::text from u', sub_v)), 'ok:0', 'verifier CANNOT verify their own submission');
  perform pg_temp.expect(pg_temp.q(v,'authenticated', format('with u as (update result_submissions set status = ''verified'' where id = %L returning 1) select count(*)::text from u', sub_a)), 'ok:1', 'verifier CAN verify another person''s submission');
  perform pg_temp.expect(pg_temp.q(v,'authenticated', 'with u as (update user_roles set role = ''super_admin'' returning 1) select count(*)::text from u'), 'ok:0', 'verifier CANNOT change roles');

  -- NO ROLE / ANONYMOUS
  perform pg_temp.expect(pg_temp.q(x,'authenticated', 'select count(*)::text from result_submissions'), 'ok:0', 'signed-in user with no role sees no submissions');
  perform pg_temp.expect(pg_temp.q(x,'authenticated', 'select count(*)::text from polling_units'), 'ok:0', 'signed-in user with no role sees no polling units');
  perform pg_temp.expect(pg_temp.q(null,'anon', 'select count(*)::text from result_submissions'), 'ok:0', 'anonymous sees no submissions (or is denied)');
  perform pg_temp.expect(pg_temp.q(null,'anon', 'select count(*)::text from polling_units'), 'ok:0', 'anonymous sees no polling units (coordinates stay private)');
  perform pg_temp.expect(pg_temp.q(null,'anon', 'select count(*)::text from geofence_checks'), 'ok:0', 'anonymous sees no location checks');
  perform pg_temp.expect(pg_temp.q(null,'anon', 'select count(*)::text from audit_log'), 'ok:0', 'anonymous sees no audit log');
  perform pg_temp.expect(pg_temp.q(null,'anon', 'select count(*)::text from public_state_votes'), 'ok:', 'anonymous CAN read the public results view');
  perform pg_temp.expect(pg_temp.q(null,'anon', format('select count(*)::text from contests where id = %L', ct)), 'ok:1', 'anonymous CAN read contests of a public election');
  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
