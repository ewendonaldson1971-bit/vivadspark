export const FIVE_S_HEADINGS = [
  "1. Sort",
  "2. Set in Order",
  "3. Shine",
  "4. Standardise",
  "5. Sustain",
] as const;

export const FIVE_S_SCORES = ["", "0", "1", "2", "3", "N/A"] as const;

export type FiveSAuditRow = {
  sourceRow: number;
  heading: string;
  itemNumber: string;
  auditQuestion: string;
  score: string;
  evidenceComments: string;
  actionRequired: string;
  owner: string;
  dueDate: string;
  status: string;
};

export function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => clean(cell))) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => clean(cell))) rows.push(row);
  }
  return rows;
}

export function parsePrinterAuditCsv(csv: string): FiveSAuditRow[] {
  return parseCsv(csv)
    .map((row, index) => ({ row, sourceRow: index + 1 }))
    .filter(({ row }) => /^\d{1,2}$/.test(clean(row[1])))
    .filter(({ row }) => Number(row[1]) >= 1 && Number(row[1]) <= 20)
    .filter(({ row }) => FIVE_S_HEADINGS.includes(clean(row[0]) as (typeof FIVE_S_HEADINGS)[number]))
    .map(({ row, sourceRow }) => ({
      sourceRow,
      heading: clean(row[0]),
      itemNumber: clean(row[1]),
      auditQuestion: clean(row[2]),
      score: normaliseScore(row[3]),
      evidenceComments: clean(row[4]),
      actionRequired: clean(row[5]),
      owner: clean(row[6]),
      dueDate: clean(row[7]),
      status: clean(row[8]),
    }));
}

export function calculateFiveSScore(rows: FiveSAuditRow[]) {
  const scored = rows
    .map((row) => Number(row.score))
    .filter((score) => Number.isFinite(score) && score >= 0 && score <= 3);
  if (!scored.length) return 0;
  return Math.round((scored.reduce((total, score) => total + score, 0) / (scored.length * 3)) * 100);
}

export function printerAuditActions(rows: FiveSAuditRow[]) {
  return rows.filter((row) => row.actionRequired || row.owner || row.dueDate);
}

function normaliseScore(value = "") {
  const score = clean(value).toUpperCase();
  return FIVE_S_SCORES.includes(score as (typeof FIVE_S_SCORES)[number]) ? score : "";
}

function clean(value = "") {
  return value.replace(/\s+/g, " ").trim();
}
