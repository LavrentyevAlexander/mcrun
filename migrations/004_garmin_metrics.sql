-- Single-row table for latest Garmin fitness metrics (upserted on each Garmin sync)
CREATE TABLE IF NOT EXISTS garmin_metrics (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    vo2_max         NUMERIC(5, 1),
    fitness_age     INTEGER,
    training_status TEXT,
    training_load   NUMERIC(7, 1),
    acute_load      NUMERIC(7, 1),
    hrv_last_night  INTEGER,
    hrv_weekly_avg  INTEGER,
    hrv_status      TEXT,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
