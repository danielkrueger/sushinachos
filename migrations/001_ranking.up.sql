CREATE TABLE IF NOT EXISTS plays (
  id BIGSERIAL PRIMARY KEY,
  game VARCHAR(10) NOT NULL CHECK (game IN ('catcher', 'runner', 'ninja')),
  player_name VARCHAR(14) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  duration_seconds NUMERIC(8, 1) NOT NULL CHECK (duration_seconds >= 0 AND duration_seconds <= 21600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plays_ranking_idx
  ON plays (game, player_name, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS plays_created_at_idx
  ON plays (game, created_at DESC);
