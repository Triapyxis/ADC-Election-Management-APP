-- 0007: audit role changes (closes 0003 gap); let agents read ONLY polling units they are actively assigned to.
-- ADDITIVE ONLY. Requires 0003. audit_row() tolerates tables without an id column (entity_id = null).
create trigger audit_user_roles after insert or update or delete on user_roles for each row execute function audit_row();
create policy assigned_read on polling_units for select using (has_active_assignment(id) or in_scope(id));
-- Note: an assigned agent can read that unit's row including coordinates. Other units remain closed.
