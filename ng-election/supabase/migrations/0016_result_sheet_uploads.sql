-- 0016: private storage for result-sheet photos/PDFs. Requires 0002, 0003.
-- NOTE: writes to the storage schema; run in the Supabase SQL editor (owner) and verify the policies in Dashboard > Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('result-sheets', 'result-sheets', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create table submission_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references result_submissions(id),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on submission_documents (submission_id);
alter table submission_documents enable row level security;
create policy owner_insert on submission_documents for insert with check (
  uploaded_by = auth.uid() and exists (select 1 from result_submissions s where s.id = submission_id and s.submitted_by = auth.uid()));
create policy owner_or_scoped_read on submission_documents for select using (exists (
  select 1 from result_submissions s where s.id = submission_id and (s.submitted_by = auth.uid() or in_scope(s.polling_unit_id))));

-- Objects live at <uploader uid>/<submission id>/<file>. Uploads use server-issued signed URLs (service role), so there is
-- deliberately NO client insert policy. Reads: the uploader, or staff in scope of the submission's polling unit. Never public.
create policy sheets_read on storage.objects for select using (
  bucket_id = 'result-sheets' and ((storage.foldername(name))[1] = auth.uid()::text or exists (
    select 1 from submission_documents d join result_submissions s on s.id = d.submission_id where d.storage_path = name and in_scope(s.polling_unit_id))));
create trigger audit_submission_documents after insert on submission_documents for each row execute function audit_row();
