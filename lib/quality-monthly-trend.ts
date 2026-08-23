type TrendEvent = { date: string | null; status: string };

export type MonthlyQualityTrend = {
  key: string;
  label: string;
  open: number;
  closed: number;
};

export const QUALITY_TREND_START = new Date(Date.UTC(2026, 7, 1));

function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildQualityMonthlyTrend(events: TrendEvent[], now = new Date(), start = QUALITY_TREND_START) {
  const firstMonth = monthStart(start);
  const latestEventMonth = events.reduce((latest, event) => {
    if (!event.date) return latest;
    const eventDate = new Date(event.date);
    if (Number.isNaN(eventDate.getTime())) return latest;
    return eventDate > latest ? eventDate : latest;
  }, firstMonth);
  const finalMonth = monthStart(latestEventMonth > now ? latestEventMonth : now);
  const months = new Map<string, MonthlyQualityTrend>();

  for (let cursor = new Date(firstMonth); cursor <= finalMonth; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    months.set(monthKey(cursor), {
      key: monthKey(cursor),
      label: cursor.toLocaleDateString("en-AU", { month: "short", year: "2-digit", timeZone: "UTC" }),
      open: 0,
      closed: 0,
    });
  }

  events.forEach((event) => {
    if (!event.date) return;
    const date = new Date(event.date);
    if (Number.isNaN(date.getTime()) || date < firstMonth) return;
    const month = months.get(monthKey(date));
    if (!month) return;
    if (event.status === "Completed") month.closed += 1;
    else month.open += 1;
  });

  return Array.from(months.values());
}
