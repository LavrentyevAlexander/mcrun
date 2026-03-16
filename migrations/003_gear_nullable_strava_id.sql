-- Allow manually-added gear (without a Strava source) by making strava_id nullable
ALTER TABLE gear ALTER COLUMN strava_id DROP NOT NULL;