ALTER TABLE garmin_metrics
    ADD COLUMN IF NOT EXISTS training_readiness  INTEGER,
    ADD COLUMN IF NOT EXISTS resting_hr          INTEGER,
    ADD COLUMN IF NOT EXISTS resting_hr_7day     TEXT,   -- JSON array [{date, value}]
    ADD COLUMN IF NOT EXISTS race_5k             TEXT,   -- predicted time string
    ADD COLUMN IF NOT EXISTS race_10k            TEXT,
    ADD COLUMN IF NOT EXISTS race_hm             TEXT,
    ADD COLUMN IF NOT EXISTS race_marathon       TEXT;
