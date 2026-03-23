CREATE TABLE goals (
  id          SERIAL PRIMARY KEY,
  year        INTEGER NOT NULL,
  description TEXT NOT NULL,
  achieved    BOOLEAN NOT NULL DEFAULT FALSE,
  result      TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX goals_year_idx ON goals (year, sort_order);

-- Initial data
INSERT INTO goals (year, description, achieved, result, sort_order) VALUES
  (2025, 'Пробежать 10 км быстрее 50 минут',                               TRUE,  '49:03',  0),
  (2025, 'Пробежать полумарафон быстрее 1:50',                              TRUE,  NULL,     1),
  (2025, 'Пробежать марафон',                                               TRUE,  NULL,     2),
  (2026, '5 км забежать в 21 минуту',                                       FALSE, NULL,     0),
  (2026, '10 км забежать в 45 минут',                                       FALSE, NULL,     1),
  (2026, 'Половинку забежать в 1:43',                                       FALSE, NULL,     2),
  (2026, 'Пробежать трейловый марафон в Дурмиторе',                         FALSE, NULL,     3),
  (2026, 'Пробежать 50 км на LastOneStanding или LastOneAlive',             FALSE, NULL,     4);
