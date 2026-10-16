-- 0018: recorded projections, kept strictly apart from results and declarations. Requires 0002, 0003.
create table projections (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references contests(id),
  method text not null, method_version text not null,
  assumptions jsonb not null,        -- plain-language assumptions shown to the public
  source_snapshot jsonb not null,    -- the exact inputs used (per-state reporting + verified votes), so it can be re-checked
  result jsonb not null,             -- { status: 'ok' | 'insufficient_data', ... }; no numbers when insufficient
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  published boolean not null default false, published_by uuid references auth.users(id), published_at timestamptz,
  check ((not published) or (result->>'status' = 'ok'))      -- an "insufficient data" run can never be published
);
create index on projections (contest_id, created_at desc);
alter table projections enable row level security;
create policy admin_all_select on projections for select using (has_role('election_admin') or has_role('super_admin'));
create policy admin_insert on projections for insert with check (created_by = auth.uid() and not published and (has_role('election_admin') or has_role('super_admin')));
create policy admin_publish on projections for update using (has_role('election_admin') or has_role('super_admin')) with check (has_role('election_admin') or has_role('super_admin'));
revoke update on projections from anon, authenticated; grant update (published, published_by, published_at) on projections to authenticated;  -- inputs and results are never edited

create view public_projections as
select distinct on (p.contest_id) p.id, p.contest_id, p.method, p.method_version, p.assumptions, p.result, p.created_at, p.published_at
from projections p join contests c on c.id = p.contest_id join elections e on e.id = c.election_id and e.is_public
where p.published order by p.contest_id, p.published_at desc;
grant select on public_projections to anon, authenticated;
create trigger audit_projections after insert or update on projections for each row execute function audit_row();
