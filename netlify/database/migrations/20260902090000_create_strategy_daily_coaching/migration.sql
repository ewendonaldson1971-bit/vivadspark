CREATE TABLE IF NOT EXISTS strategy_daily_coaching (
  actor TEXT NOT NULL,
  department TEXT NOT NULL,
  input_data JSONB NOT NULL,
  coaching_data JSONB NOT NULL,
  provider TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (actor, department)
);

CREATE INDEX IF NOT EXISTS strategy_daily_coaching_generated_idx
  ON strategy_daily_coaching (actor, generated_at DESC);
