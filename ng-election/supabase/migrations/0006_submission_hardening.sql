-- 0006: tighten 0003 submission rules; add atomic submit function. Requires 0002, 0003.
-- Only replaces policies created in 0003; no data is dropped.
alter table result_submissions add column decision_note text;
alter table result_submissions add constraint rejected_needs_note
  check (status <> 'rejected' or char_length(btrim(coalesce(decision_note,''))) >= 10);

-- Agents cannot self-report location compliance: the server sets it after evaluating evidence.
drop policy agent_insert on result_submissions;
create policy agent_insert on result_submissions for insert with check (
  submitted_by = auth.uid() and status = 'submitted' and geofence_status = 'not_checked'
  and has_role('field_agent') and has_active_assignment(polling_unit_id));

-- Verifiers cannot decide their own submissions, and may only change status + note.
drop policy verifier_decide on result_submissions;
create policy verifier_decide on result_submissions for update
  using (has_role('verifier') and in_scope(polling_unit_id) and submitted_by is distinct from auth.uid()
         and status in ('submitted','pending_verification'))
  with check (status in ('verified','rejected','pending_verification'));
revoke update on result_submissions from anon, authenticated;
grant update (status, decision_note) on result_submissions to authenticated;

-- One transaction: submission + votes together, under the caller's RLS (security invoker).
create function submit_result(p_contest uuid, p_pu uuid, p_key text, p_device_time timestamptz, p_votes jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare sid uuid;
begin
  insert into result_submissions(contest_id, polling_unit_id, submitted_by, status, idempotency_key, device_time)
  values (p_contest, p_pu, auth.uid(), 'submitted', p_key, p_device_time) returning id into sid;
  insert into candidate_votes(submission_id, candidate_id, votes)
  select sid, (e->>'candidateId')::uuid, (e->>'votes')::int from jsonb_array_elements(p_votes) e;
  return sid;
end $$;
revoke all on function submit_result from public; grant execute on function submit_result to authenticated;
