type TrendEvent = { date: string | null; dateClosed: string | null };

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
    const dates = [event.date, event.dateClosed]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));
    return dates.reduce((latestDate, eventDate) => eventDate > latestDate ? eventDate : latestDate, latest);
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
    if (event.date) {
      const openedDate = new Date(event.date);
      if (!Number.isNaN(openedDate.getTime()) && openedDate >= firstMonth) {
        const openedMonth = months.get(monthKey(openedDate));
        if (openedMonth) openedMonth.open += 1;
      }
    }
    if (event.dateClosed) {
      const closedDate = new Date(event.dateClosed);
      if (!Number.isNaN(closedDate.getTime()) && closedDate >= firstMonth) {
        const closedMonth = months.get(monthKey(closedDate));
        if (closedMonth) closedMonth.closed += 1;
      }
    }
  });

  return Array.from(months.values());
}
