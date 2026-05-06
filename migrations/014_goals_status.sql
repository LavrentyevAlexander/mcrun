ALTER TABLE goals ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress';
UPDATE goals SET status = 'achieved' WHERE achieved = TRUE;
ALTER TABLE goals DROP COLUMN achieved;
