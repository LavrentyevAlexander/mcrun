-- Indexes to speed up activity queries involving gear lookups and date filters
CREATE INDEX IF NOT EXISTS idx_activities_gear_id ON activities(gear_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_date_gear ON activities(date DESC, gear_id);
