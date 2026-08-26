import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import { FiveSAuditRow } from "./five-s-audit";

let cachedDatabase: ReturnType<typeof getDatabase> | undefined;

export class FiveSConfigurationError extends Error {}

function database() {
  try {
    cachedDatabase ??= getDatabase();
    return cachedDatabase;
  } catch (error) {
    if (error instanceof MissingDatabaseConnectionError) {
      throw new FiveSConfigurationError("5S working-copy storage is not configured.");
    }
    throw error;
  }
}

export async function applyFiveSOverrides(department: string, rows: FiveSAuditRow[]) {
  const result = await database().pool.query(
    `SELECT source_row, heading, item_number, audit_question, score, evidence_comments,
            action_required, owner, due_date, status
     FROM five_s_audit_overrides WHERE department = $1`,
    [department],
  );
  const overrides = new Map(
    (result.rows as Record<string, unknown>[]).map((row) => [Number(row.source_row), row]),
  );
  return rows.map((row) => {
    const override = overrides.get(row.sourceRow);
    if (!override) return row;
    return {
      ...row,
      heading: String(override.heading),
      itemNumber: String(override.item_number),
      auditQuestion: String(override.audit_question),
      score: String(override.score),
      evidenceComments: String(override.evidence_comments),
      actionRequired: String(override.action_required ?? ""),
      owner: String(override.owner ?? ""),
      dueDate: String(override.due_date ?? ""),
      status: String(override.status ?? ""),
    };
  });
}

export async function saveFiveSOverride(department: string, row: FiveSAuditRow) {
  const updatedAt = new Date().toISOString();
  await database().pool.query(
    `INSERT INTO five_s_audit_overrides
       (department, source_row, heading, item_number, audit_question, score, evidence_comments,
        action_required, owner, due_date, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (department, source_row) DO UPDATE SET
       heading = EXCLUDED.heading,
       item_number = EXCLUDED.item_number,
       audit_question = EXCLUDED.audit_question,
       score = EXCLUDED.score,
       evidence_comments = EXCLUDED.evidence_comments,
       action_required = EXCLUDED.action_required,
       owner = EXCLUDED.owner,
       due_date = EXCLUDED.due_date,
       status = EXCLUDED.status,
       updated_at = EXCLUDED.updated_at`,
    [department, row.sourceRow, row.heading, row.itemNumber, row.auditQuestion, row.score, row.evidenceComments,
      row.actionRequired, row.owner, row.dueDate, row.status, updatedAt],
  );
  return { ...row, updatedAt };
}
