const BUDGET_TIME_ZONE = "Europe/Podgorica";

export function getBudgetCycle(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUDGET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const cycleDate = day >= 19 ? new Date(Date.UTC(year, month - 1, 1)) : new Date(Date.UTC(year, month - 2, 1));
  return `${cycleDate.getUTCFullYear()}-${String(cycleDate.getUTCMonth() + 1).padStart(2, "0")}`;
}
