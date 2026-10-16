-- 0013: official declarations (separate from verification) + admin write access for election setup. Requires 0002, 0003.
alter table candidates add constraint candidates_id_contest_uniq unique (id, contest_id);

create table declarations (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references contests(id),
  candidate_id uuid not null,
  declared_by uuid not null references auth.users(id),
  declared_at timestamptz not null default now(),
  source_reference text not null check (char_length(btrim(source_reference)) >= 10),  -- e.g. INEC form/notice reference
  revoked_at timestamptz, revoked_by uuid references auth.users(id), revoke_reason text,
  foreign key (candidate_id, contest_id) references candidates (id, contest_id),      -- winner must belong to this contest
  check ((revoked_at is null) or char_length(btrim(coalesce(revoke_reason,''))) >= 10)
);
create unique index one_active_declaration on declarations (contest_id) where revoked_at is null;
alter table declarations enable row level security;

create policy admin_declare on declarations for insert with check (declared_by = auth.uid() and (has_role('election_admin') or has_role('super_admin')));
create policy admin_read on declarations for select using (has_role('election_admin') or has_role('super_admin'));
create policy admin_revoke on declarations for update using (has_role('election_admin') or has_role('super_admin')) with check (revoked_by = auth.uid());
revoke update on declarations from anon, authenticated; grant update (revoked_at, revoked_by, revoke_reason) on declarations to authenticated;  -- history is never edited

create view public_declarations as
select d.contest_id, c.type, d.candidate_id, cand.full_name, cand.party_id, p.abbreviation as party, p.brand_colour, d.declared_at, d.source_reference
from declarations d join contests c on c.id = d.contest_id join elections e on e.id = c.election_id and e.is_public
join candidates cand on cand.id = d.candidate_id join parties p on p.id = cand.party_id where d.revoked_at is null;
grant select on public_declarations to anon, authenticated;

-- Election setup: writable only by election_admin / super_admin; they can also see non-public elections.
create policy admin_all on elections for all using (has_role('election_admin') or has_role('super_admin')) with check (has_role('election_admin') or has_role('super_admin'));
create policy admin_all on contests for all using (has_role('election_admin') or has_role('super_admin')) with check (has_role('election_admin') or has_role('super_admin'));
create policy admin_write on candidates for insert with check (has_role('election_admin') or has_role('super_admin'));
create policy admin_write on parties for insert with check (has_role('election_admin') or has_role('super_admin'));

create trigger audit_declarations after insert or update on declarations for each row execute function audit_row();
create trigger audit_elections after insert or update or delete on elections for each row execute function audit_row();
create trigger audit_contests after insert or update or delete on contests for each row execute function audit_row();
create trigger audit_candidates after insert on candidates for each row execute function audit_row();
create trigger audit_parties after insert on parties for each row execute function audit_row();
