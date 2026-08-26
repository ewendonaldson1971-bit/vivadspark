export const FIVE_S_HEADINGS = [
  "1. Sort",
  "2. Set in Order",
  "3. Shine",
  "4. Standardise",
  "5. Sustain",
] as const;

export const FIVE_S_SCORES = ["", "0", "1", "2", "3", "N/A"] as const;

export const FIVE_S_AUDIT_DEPARTMENTS = [
  "CST",
  "Prepress",
  "Printers",
  "Cutters",
  "Fab1",
  "Framing",
  "Sew",
  "Light Box",
  "Office",
  "Despatch",
] as const;

export const FIVE_S_AUDIT_CONFIG: Record<(typeof FIVE_S_AUDIT_DEPARTMENTS)[number], { sheetName: string; gid: string }> = {
  CST: { sheetName: "Office Audit", gid: "599377197" },
  Prepress: { sheetName: "Office Audit", gid: "599377197" },
  Printers: { sheetName: "Printer Audit", gid: "1116237291" },
  Cutters: { sheetName: "Cutter Audit", gid: "1289253712" },
  Fab1: { sheetName: "Fabrication Audit", gid: "1235865249" },
  Framing: { sheetName: "Fabrication Audit", gid: "1235865249" },
  Sew: { sheetName: "Fabrication Audit", gid: "1235865249" },
  "Light Box": { sheetName: "Lightbox Audit", gid: "1199911755" },
  Office: { sheetName: "Office Audit", gid: "599377197" },
  Despatch: { sheetName: "Despatch Audit", gid: "1412019244" },
};

export function getFiveSAuditConfig(department: string) {
  return FIVE_S_AUDIT_CONFIG[department as keyof typeof FIVE_S_AUDIT_CONFIG] ?? null;
}

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

export function parseFiveSAuditCsv(csv: string): FiveSAuditRow[] {
  const seenItems = new Set<string>();
  return parseCsv(csv)
    .map((row, index) => ({ row, sourceRow: index + 1 }))
    .filter(({ row }) => /^\d{1,2}$/.test(clean(row[1])))
    .filter(({ row }) => Number(row[1]) >= 1 && Number(row[1]) <= 20)
    .filter(({ row }) => FIVE_S_HEADINGS.includes(clean(row[0]) as (typeof FIVE_S_HEADINGS)[number]))
    .filter(({ row }) => {
      const itemNumber = clean(row[1]);
      if (seenItems.has(itemNumber)) return false;
      seenItems.add(itemNumber);
      return true;
    })
    .map(({ row, sourceRow }) => ({
      sourceRow,
      heading: clean(row[0]),
      itemNumber: clean(row[1]),
      auditQuestion: clean(row[2]),
      score: normaliseScore(row[3]),
      evidenceComments: clean(row[4]),
      actionRequired: clean(row[5]),
      owner: clean(row[6]),
      dueDate: normaliseDueDate(row[7]),
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

export function fiveSAuditActions(rows: FiveSAuditRow[]) {
  return rows.filter((row) => row.actionRequired || row.owner || row.dueDate);
}

export const parsePrinterAuditCsv = parseFiveSAuditCsv;
export const printerAuditActions = fiveSAuditActions;

function normaliseScore(value = "") {
  const score = clean(value).toUpperCase();
  return FIVE_S_SCORES.includes(score as (typeof FIVE_S_SCORES)[number]) ? score : "";
}

function normaliseDueDate(value = "") {
  const date = clean(value);
  const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return date;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function clean(value = "") {
  return value.replace(/\s+/g, " ").trim();
}
