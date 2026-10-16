-- Replace the emails with users you created in Supabase Auth. Run in the SQL editor (service role).
-- Scope: state-level roles need a state; national roles do not.
insert into user_roles (user_id, role) select id, 'super_admin' from auth.users where email = 'you@example.com';
insert into user_roles (user_id, role, state_id)
  select u.id, 'supervisor', s.id from auth.users u, states s where u.email = 'supervisor@example.com' and s.name = 'Lagos';
insert into user_roles (user_id, role, state_id)
  select u.id, 'verifier', s.id from auth.users u, states s where u.email = 'verifier@example.com' and s.name = 'Lagos';
insert into user_roles (user_id, role, state_id)
  select u.id, 'field_agent', s.id from auth.users u, states s where u.email = 'agent@example.com' and s.name = 'Lagos';
