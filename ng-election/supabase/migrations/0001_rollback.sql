-- Manual rollback for 0001 only. Review before running; this deletes imported data.
drop table if exists import_runs, polling_units, wards, lgas,
  federal_constituencies, senatorial_districts, states;
drop type if exists geocode_status;
