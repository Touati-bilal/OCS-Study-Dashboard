/**
 * Week-window maths for PRV weekly reports.
 *
 * A report week ends on a configurable day of the week (Sunday by default) and always spans
 * exactly 7 days, so the same week key is produced on the server, in the browser and in a cron
 * run. All arithmetic is done in UTC on date-only strings, which keeps a DST change or a
 * timezone difference from shifting a week boundary.
 *
 * Two date shapes appear in the real store and both are handled: `deadline` is a date-only
 * `YYYY-MM-DD` string, while `createdAt` / `completedAt` are full ISO timestamps.
 */

export type IsoDate = string; // YYYY-MM-DD

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Default: a week ends on Sunday (0). */
export const DEFAULT_REPORT_DAY = 0;

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Normalises a stored task date to `YYYY-MM-DD`, or `null` when it is absent/unusable.
 * An ISO timestamp is truncated to its date part, matching how the store wrote it.
 */
export function toIsoDate(value: string | null | undefined): IsoDate | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 10) return null;
  const candidate = trimmed.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const ms = Date.parse(`${candidate}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  // Date.parse is lenient and rolls 2026-02-30 over to 2026-03-02, so a round-trip check is the
  // only reliable way to reject impossible dates.
  if (new Date(ms).toISOString().slice(0, 10) !== candidate) return null;
  return candidate;
}

function toUtcMs(iso: IsoDate): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(iso) + days * MS_PER_DAY);
}

/** Whole days between two dates; positive when `to` is later. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: IsoDate): number {
  return new Date(toUtcMs(iso)).getUTCDay();
}

export function todayIso(now: Date = new Date()): IsoDate {
  return now.toISOString().slice(0, 10);
}

export interface WeekWindow {
  /** Inclusive first day of the week. */
  weekStart: IsoDate;
  /** Inclusive last day of the week; the day the report is generated. */
  weekEnd: IsoDate;
}

export function isValidReportDay(day: unknown): day is number {
  return typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6;
}

/**
 * The most recent occurrence of `reportDay` on or before `anchor`.
 * A report generated exactly on the configured day belongs to the week ending that day.
 */
export function getWeekEndFor(anchor: IsoDate, reportDay: number = DEFAULT_REPORT_DAY): IsoDate {
  const day = isValidReportDay(reportDay) ? reportDay : DEFAULT_REPORT_DAY;
  const delta = (dayOfWeek(anchor) - day + 7) % 7;
  return addDays(anchor, -delta);
}

/**
 * The last week that had already finished on `anchor`.
 *
 * This is the week a report describes. Note it is *not* the week containing `anchor`: on
 * Wednesday, with Sunday as the report day, the last completed week ended on the Sunday before.
 */
export function getLastCompletedWeek(anchor: IsoDate, reportDay: number = DEFAULT_REPORT_DAY): WeekWindow {
  const weekEnd = getWeekEndFor(anchor, reportDay);
  return { weekStart: addDays(weekEnd, -6), weekEnd };
}

/**
 * The week a date falls into. It can be the in-progress week, whose end is after the date.
 * Use this for "this week" views; use `getLastCompletedWeek` for reports.
 *
 * The week end is the *next* occurrence of `reportDay` on or after the date, so a date that falls
 * on the report day itself belongs to the week ending that day, not to the one starting after it.
 */
export function getWeekContaining(iso: IsoDate, reportDay: number = DEFAULT_REPORT_DAY): WeekWindow {
  const day = isValidReportDay(reportDay) ? reportDay : DEFAULT_REPORT_DAY;
  const delta = (day - dayOfWeek(iso) + 7) % 7;
  const weekEnd = addDays(iso, delta);
  return { weekStart: addDays(weekEnd, -6), weekEnd };
}

export function isWithin(iso: IsoDate, start: IsoDate, end: IsoDate): boolean {
  const value = toUtcMs(iso);
  return value >= toUtcMs(start) && value <= toUtcMs(end);
}

/** Every week end in `[from, to]`, oldest first. Used to backfill report history. */
export function listWeekEnds(from: IsoDate, to: IsoDate, reportDay: number = DEFAULT_REPORT_DAY): IsoDate[] {
  const ends: IsoDate[] = [];
  let cursor = getWeekEndFor(to, reportDay);
  const floor = getWeekEndFor(from, reportDay);
  while (toUtcMs(cursor) >= toUtcMs(floor)) {
    ends.push(cursor);
    cursor = addDays(cursor, -7);
  }
  return ends.reverse();
}

/**
 * Stable idempotency key for a week. Report generation is keyed on this, so re-running the cron
 * for the same week updates the existing report instead of creating a duplicate.
 */
export function weekKey(weekEnd: IsoDate): string {
  return `w-${weekEnd}`;
}

const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** "21 – 27 sept. 2026", collapsing the repeated month when both ends share one. */
export function formatWeekRange(weekStart: IsoDate, weekEnd: IsoDate): string {
  const start = new Date(toUtcMs(weekStart));
  const end = new Date(toUtcMs(weekEnd));
  const startMonth = MONTHS[start.getUTCMonth()];
  const endMonth = MONTHS[end.getUTCMonth()];
  const year = end.getUTCFullYear();
  if (startMonth === endMonth && start.getUTCFullYear() === year) {
    return `${start.getUTCDate()} – ${end.getUTCDate()} ${endMonth} ${year}`;
  }
  return `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth} ${year}`;
}

export function formatDayName(day: number): string {
  return DAY_NAMES[isValidReportDay(day) ? day : DEFAULT_REPORT_DAY];
}

/** French short date used in tables and lists. */
export function formatShortDate(iso: IsoDate): string {
  const date = new Date(toUtcMs(iso));
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
