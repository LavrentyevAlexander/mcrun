ALTER TABLE garmin_metrics
    ADD COLUMN IF NOT EXISTS sleep_score_feedback   TEXT,
    ADD COLUMN IF NOT EXISTS recovery_time_feedback TEXT,
    ADD COLUMN IF NOT EXISTS vo2_max_label          TEXT,
    ADD COLUMN IF NOT EXISTS lt_hr                  INTEGER,
    ADD COLUMN IF NOT EXISTS lt_pace                TEXT,
    ADD COLUMN IF NOT EXISTS endurance_score        INTEGER,
    ADD COLUMN IF NOT EXISTS endurance_label        TEXT,
    ADD COLUMN IF NOT EXISTS avg_stress             INTEGER,
    ADD COLUMN IF NOT EXISTS heat_acclim_level      TEXT;
