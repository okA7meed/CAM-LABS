/**
 * Centralized user-facing date/time formatting for the Admin Panel.
 *
 * DISPLAY RULES (global requirement):
 *  - Clock times always use the 12-hour clock with AM/PM ("5:42 PM",
 *    never "17:42"). Hour is numeric (no zero-padding) per house style.
 *  - Midnight -> "12:00 AM", noon -> "12:00 PM".
 *  - Day grouping respects the application's display timezone,
 *    Africa/Cairo (the backend buckets dashboards the same way), so a
 *    23:59 local event never leaks into the wrong day because UTC was
 *    compared raw.
 *
 * STORAGE IS NEVER TOUCHED HERE: inputs are ISO strings/Dates/epochs as
 * stored (UTC); only the rendered text changes. Database timestamps,
 * timezones and API serialization are out of scope for this module.
 */

export const DISPLAY_TIME_ZONE = 'Africa/Cairo';

const clockFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const longDateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const shortDateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const toDate = (value: string | number | Date): Date | null => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "17:30" -> "5:30 PM", "00:05" -> "12:05 AM", "12:00" -> "12:00 PM".
 *  Rendered in the display timezone (Africa/Cairo), matching grouping. */
export function formatClock12h(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return '—';
  return clockFmt.format(date);
}

/** "Sep 17, 2026" (date-only fields are untouched by clock rules). */
export function formatShortDate(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return '—';
  return shortDateFmt.format(date);
}

/** "September 19, 2026" — group context labels. */
export function formatLongDate(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return '—';
  return longDateFmt.format(date);
}

/** Calendar-day key ("2026-09-19") in the display timezone. */
export function displayDayKey(value: string | number | Date): string | null {
  const date = toDate(value);
  if (!date) return null;
  return dayKeyFmt.format(date);
}

export type DayBucket = 'today' | 'yesterday' | 'earlier';

/** Bucket an event into today / yesterday / earlier by display-timezone day. */
export function bucketDay(value: string | number | Date, now: number | Date = Date.now()): DayBucket | null {
  const date = toDate(value);
  if (!date) return null;
  const nowMs = now instanceof Date ? now.getTime() : now;
  const key = (t: number) => dayKeyFmt.format(new Date(t));
  if (key(date.getTime()) === key(nowMs)) return 'today';
  // Yesterday via calendar-date arithmetic: midnight UTC of today's Cairo
  // date, stepped back 12h, always lands mid-day of the previous Cairo day
  // (immune to DST 23/25-hour days, unlike a fixed 24h step from `now`).
  const [y, m, d] = key(nowMs).split('-').map(Number);
  const yesterdayKey = key(Date.UTC(y, m - 1, d) - 12 * 3_600_000);
  if (key(date.getTime()) === yesterdayKey) return 'yesterday';
  return 'earlier';
}
