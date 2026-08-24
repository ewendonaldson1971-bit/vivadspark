const SYDNEY_TIME_ZONE = "Australia/Sydney";

function ordinal(day: number) {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

export function formatSydneyPortalDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const time = `${value("hour").padStart(2, "0")}:${value("minute")}${value("dayPeriod").toLowerCase()}`;
  return `${value("weekday")} ${ordinal(Number(value("day")))} ${value("month")} ${value("year")} - ${time}`;
}
