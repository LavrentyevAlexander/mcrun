-- Gear (shoes) from Strava
CREATE TABLE IF NOT EXISTS gear (
    id         SERIAL PRIMARY KEY,
    strava_id  VARCHAR(64) UNIQUE NOT NULL,
    name       TEXT NOT NULL,
    total_km   NUMERIC(10, 2),
    limit_km   INTEGER,
    synced_at  TIMESTAMPTZ
);

-- Running activities from Strava
CREATE TABLE IF NOT EXISTS activities (
    id              SERIAL PRIMARY KEY,
    strava_id       BIGINT UNIQUE NOT NULL,
    date            DATE NOT NULL,
    name            TEXT,
    distance_km     NUMERIC(8, 3) NOT NULL,
    elapsed_sec     INTEGER NOT NULL,
    moving_sec      INTEGER,
    avg_hr          SMALLINT,
    elevation_m     NUMERIC(7, 1),
    relative_effort INTEGER,
    gear_id         INTEGER REFERENCES gear (id),
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activities_date_idx ON activities (date DESC);
CREATE INDEX IF NOT EXISTS activities_gear_idx ON activities (gear_id);

-- Personal records from Garmin
CREATE TABLE IF NOT EXISTS personal_records (
    id                 SERIAL PRIMARY KEY,
    label              VARCHAR(32) NOT NULL,
    distance_m         INTEGER NOT NULL,
    time_sec           INTEGER NOT NULL,
    date               DATE,
    garmin_activity_id BIGINT,
    activity_name      TEXT,
    synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync audit log
CREATE TABLE IF NOT EXISTS sync_log (
    id             SERIAL PRIMARY KEY,
    source         VARCHAR(16) NOT NULL,
    status         VARCHAR(16) NOT NULL,
    records_synced INTEGER,
    error_detail   TEXT,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at    TIMESTAMPTZ
);

-- Migrate gear limits from gear_limits.json into gear table
-- (run manually or extend with INSERT ... ON CONFLICT after gear records exist)

-- Extend competitions with created_at
ALTER TABLE competitions
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
