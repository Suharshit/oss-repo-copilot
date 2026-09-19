import { OVERVIEW_TTL_DAYS } from "../constants/index.ts";

export function formatRelativeTime(
  isoDate: string,
  now: Date = new Date(),
): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "unknown";

  const seconds = Math.round((then - now.getTime()) / 1000);
  // Every caller shows a past moment. Something from the last minute, or a
  // few seconds "ahead" because the server's clock leads the browser's,
  // would otherwise read "in 4 seconds".
  if (seconds > -60) return "just now";

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(seconds) >= secondsPerUnit) {
      return formatter.format(Math.round(seconds / secondsPerUnit), unit);
    }
  }
  return formatter.format(Math.round(seconds / 60), "minute");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** Expiry timestamp for a freshly generated overview. */
export function overviewExpiry(
  generatedAt: Date = new Date(),
  ttlDays: number = OVERVIEW_TTL_DAYS,
): string {
  return new Date(generatedAt.getTime() + ttlDays * 86_400_000).toISOString();
}

export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  const expiry = new Date(expiresAt).getTime();
  return Number.isNaN(expiry) || expiry <= now.getTime();
}
