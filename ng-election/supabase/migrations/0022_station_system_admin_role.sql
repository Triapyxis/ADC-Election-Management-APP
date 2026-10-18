-- Add the least-privilege role for designated Situation Room station support. Keep this enum change isolated.
alter type app_role add value if not exists 'station_system_admin';
