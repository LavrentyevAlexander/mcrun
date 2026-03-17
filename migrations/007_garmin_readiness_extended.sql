ALTER TABLE garmin_metrics
    ADD COLUMN readiness_level    TEXT,
    ADD COLUMN readiness_feedback TEXT,
    ADD COLUMN sleep_score        INTEGER,
    ADD COLUMN recovery_time      INTEGER,
    ADD COLUMN acwr_feedback      TEXT;
