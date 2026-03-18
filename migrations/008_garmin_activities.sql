CREATE TABLE IF NOT EXISTS garmin_activities (
  garmin_id     BIGINT PRIMARY KEY,
  date          DATE NOT NULL,
  name          TEXT,
  activity_type TEXT,
  distance_km   DECIMAL(6, 2),
  duration_sec  INTEGER,
  calories      INTEGER,
  aerobic_te    DECIMAL(3, 1),
  anaerobic_te  DECIMAL(3, 1),
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS garmin_activities_date_idx ON garmin_activities (date);
