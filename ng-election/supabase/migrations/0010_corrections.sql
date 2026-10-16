-- 0010: corrections as new linked submissions; originals are never edited. Requires 0002, 0003, 0006.
create function submit_correction(p_original uuid, p_key text, p_device_time timestamptz, p_votes jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare o result_submissions; sid uuid;
begin
  select * into o from result_submissions where id = p_original and submitted_by = auth.uid();   -- RLS also applies
  if not found then raise exception 'original not found or not yours'; end if;
  if o.status = 'declared' then raise exception 'declared results cannot be corrected here'; end if;
  insert into result_submissions(contest_id, polling_unit_id, submitted_by, status, supersedes_id, idempotency_key, device_time)
  values (o.contest_id, o.polling_unit_id, auth.uid(), 'submitted', o.id, p_key, p_device_time) returning id into sid;
  insert into candidate_votes(submission_id, candidate_id, votes)
  select sid, (e->>'candidateId')::uuid, (e->>'votes')::int from jsonb_array_elements(p_votes) e;
  return sid;
end $$;
revoke all on function submit_correction from public; grant execute on function submit_correction to authenticated;
