-- 0019: add the broadcast_operator role. Must be its own migration: a new enum value cannot be used in the same transaction.
alter type app_role add value if not exists 'broadcast_operator';
