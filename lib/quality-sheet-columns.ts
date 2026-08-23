export type QualitySheetColumns = {
  status: number;
  category: number;
  origin: number;
  date: number;
  progression: number;
  dateClosed: number;
  jobNumber: number;
  department: number;
  reportedBy: number;
  assignedTo: number;
  description: number;
  severity: number;
  rootCause: number;
  action: number;
  remediationCost: number;
  sopOutcome: number;
  processed: number;
};

function normaliseHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findColumn(headers: string[], fallback: number, ...matches: string[]) {
  const exactIndex = headers.findIndex((header) => matches.includes(header));
  if (exactIndex >= 0) return exactIndex;
  const partialIndex = headers.findIndex((header) => matches.some((match) => header.includes(match)));
  return partialIndex >= 0 ? partialIndex : fallback;
}

export function resolveQualitySheetColumns(headerRow: string[]): QualitySheetColumns {
  const headers = headerRow.map(normaliseHeader);
  return {
    // The first source column contains the lifecycle status but currently has
    // a numeric sheet heading, so its documented position remains the fallback.
    status: findColumn(headers, 0, "status"),
    category: findColumn(headers, 1, "category"),
    origin: findColumn(headers, 2, "issue spotted"),
    date: findColumn(headers, 3, "date"),
    progression: findColumn(headers, 4, "days open"),
    dateClosed: findColumn(headers, 5, "date closed"),
    jobNumber: findColumn(headers, 6, "job number"),
    department: findColumn(headers, 7, "department"),
    reportedBy: findColumn(headers, 8, "reported by"),
    assignedTo: findColumn(headers, 9, "best person"),
    description: findColumn(headers, 10, "what has occured", "what has occurred"),
    severity: findColumn(headers, 11, "severity"),
    rootCause: findColumn(headers, 12, "root cause"),
    action: findColumn(headers, 13, "potential solution", "remedial action"),
    remediationCost: findColumn(headers, 14, "cost of remediation"),
    sopOutcome: findColumn(headers, 15, "sops link", "sop link", "sop outcome"),
    processed: findColumn(headers, 16, "nce processed"),
  };
}
