export type MachineCapacity = {
  machine: string;
  capacity: number;
  status: string;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, maxLength) : "";
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (character === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(field); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

export function parseMachineCapacityCsv(csv: string): MachineCapacity[] {
  const [headers = [], ...rows] = parseCsv(csv);
  const normalised = headers.map((header) => header.trim().toLowerCase());
  const machineIndex = normalised.indexOf("workstation");
  const capacityIndex = normalised.indexOf("capacity");
  const statusIndex = normalised.indexOf("machine status");
  if (machineIndex < 0 || capacityIndex < 0) return [];

  return rows.flatMap((row) => {
    const machine = clean(row[machineIndex], 100);
    const capacityText = clean(row[capacityIndex], 20).replace(/%/g, "").replace(/,/g, ".");
    const capacity = Number(capacityText);
    if (!machine || !Number.isFinite(capacity)) return [];
    return [{
      machine,
      capacity: Math.min(100, Math.max(0, capacity)),
      status: statusIndex >= 0 ? clean(row[statusIndex], 60) : "",
    }];
  });
}
