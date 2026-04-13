ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS fitness_score FLOAT,
    ADD COLUMN IF NOT EXISTS fitness_delta FLOAT;
