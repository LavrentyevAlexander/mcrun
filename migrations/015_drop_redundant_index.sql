-- idx_activities_date (date DESC) is fully covered by the composite
-- idx_activities_date_gear (date DESC, gear_id) from migration 013 — Postgres
-- uses the leading column for date-only range scans and ORDER BY. Drop the
-- standalone index to cut write amplification and storage.
DROP INDEX IF EXISTS idx_activities_date;
