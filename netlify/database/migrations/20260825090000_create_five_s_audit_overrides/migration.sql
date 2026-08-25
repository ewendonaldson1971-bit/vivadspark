CREATE TABLE IF NOT EXISTS five_s_audit_overrides (
  department TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  heading TEXT NOT NULL,
  item_number TEXT NOT NULL,
  audit_question TEXT NOT NULL,
  score TEXT NOT NULL DEFAULT '',
  evidence_comments TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (department, source_row),
  CONSTRAINT five_s_score_valid CHECK (score IN ('', '0', '1', '2', '3', 'N/A'))
);

CREATE INDEX IF NOT EXISTS five_s_audit_overrides_department_idx
  ON five_s_audit_overrides (department);
