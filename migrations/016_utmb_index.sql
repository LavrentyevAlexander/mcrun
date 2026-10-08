-- UTMB Index snapshots + synced race results from the public UTMB World
-- Series API (https://api.utmb.world/runners/<uri>). One row per sync day;
-- re-syncing the same day updates the existing row.
CREATE TABLE utmb_index_history (
  id             SERIAL PRIMARY KEY,
  date           DATE NOT NULL UNIQUE,
  general_index  INTEGER,
  index_20k      INTEGER,
  index_50k      INTEGER,
  index_100k     INTEGER,
  index_100m     INTEGER,
  nationality    TEXT,
  age_group      TEXT,
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE utmb_races (
  id            SERIAL PRIMARY KEY,
  utmb_uri      TEXT NOT NULL UNIQUE,
  date          DATE NOT NULL,
  event_name    TEXT NOT NULL,
  race_name     TEXT NOT NULL,
  distance_km   NUMERIC,
  elevation_m   INTEGER,
  time          TEXT,
  pi_category   TEXT,
  rank          INTEGER,
  rank_gender   INTEGER,
  total_ranked  INTEGER,
  is_dnf        BOOLEAN NOT NULL DEFAULT FALSE,
  country       TEXT,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX utmb_races_date_idx ON utmb_races (date DESC);
