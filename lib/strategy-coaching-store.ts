import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import type { StrategyCoaching, StrategyCoachingInput } from "./strategy-coaching";

export class StrategyCoachingConfigurationError extends Error {}

export type SavedStrategyCoaching = {
  input: StrategyCoachingInput;
  coaching: StrategyCoaching;
  provider: string;
  generatedAt: string;
};

type Row = Record<string, unknown>;
let cached: ReturnType<typeof getDatabase> | undefined;

function db() {
  try {
    cached ??= getDatabase();
    return cached;
  } catch (error) {
    if (error instanceof MissingDatabaseConnectionError) {
      throw new StrategyCoachingConfigurationError("Strategy coaching storage is not configured. Connect Netlify Database to this site.");
    }
    throw error;
  }
}

function recordFromRow(row: Row): SavedStrategyCoaching {
  return {
    input: row.input_data as StrategyCoachingInput,
    coaching: row.coaching_data as StrategyCoaching,
    provider: String(row.provider),
    generatedAt: String(row.generated_at),
  };
}

export async function listStrategyCoaching(actor: string) {
  const result = await db().pool.query(
    `SELECT department, input_data, coaching_data, provider, generated_at
      FROM strategy_daily_coaching
      WHERE actor = $1
      ORDER BY generated_at DESC`,
    [actor.toLowerCase()],
  );
  return Object.fromEntries((result.rows as Row[]).map((row) => [String(row.department), recordFromRow(row)]));
}

export async function saveStrategyCoaching(actor: string, record: SavedStrategyCoaching) {
  await db().pool.query(
    `INSERT INTO strategy_daily_coaching (actor, department, input_data, coaching_data, provider, generated_at)
      VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6)
      ON CONFLICT (actor, department) DO UPDATE SET
        input_data=EXCLUDED.input_data,
        coaching_data=EXCLUDED.coaching_data,
        provider=EXCLUDED.provider,
        generated_at=EXCLUDED.generated_at`,
    [
      actor.toLowerCase(),
      record.input.department,
      JSON.stringify(record.input),
      JSON.stringify(record.coaching),
      record.provider,
      record.generatedAt,
    ],
  );
  return record;
}
