// Gatherings are monthly; months are "YYYY-MM" strings so no time zone can shift them.
export function addMonths(yearMonth: string, months: number): string {
  const [year, month] = yearMonth.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
