import type { Language } from "../types/language.type";

// Western digits in both languages so amounts and dates read the same way everywhere in the app.
const locale = (language: Language) => (language === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB");

export function formatMonth(yearMonth: string, language: Language): string {
  const [year, month] = yearMonth.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat(locale(language), { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function formatDay(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(locale(language), { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(iso),
  );
}

export function formatTime(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(locale(language), { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatAgo(iso: string, language: Language, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  const format = new Intl.RelativeTimeFormat(locale(language), { numeric: "auto" });
  if (minutes < 60) return format.format(-minutes, "minute");
  if (minutes < 24 * 60) return format.format(-Math.round(minutes / 60), "hour");
  return format.format(-Math.round(minutes / (24 * 60)), "day");
}

export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
