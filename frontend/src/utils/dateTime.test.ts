import { describe, expect, it } from 'vitest';
import { bucketDay, displayDayKey, formatClock12h, formatLongDate, formatShortDate } from './dateTime';

describe('formatClock12h', () => {
  // September => Cairo is UTC+3. Instants below are chosen so the CAIRO
  // wall time hits each boundary case (formatter is Cairo-anchored).
  it('formats midnight as 12:00 AM', () => {
    expect(formatClock12h('2026-09-18T21:00:00.000Z')).toBe('12:00 AM');
  });
  it('formats early morning without zero-padding', () => {
    expect(formatClock12h('2026-09-18T21:30:00.000Z')).toBe('12:30 AM');
    expect(formatClock12h('2026-09-19T06:05:00.000Z')).toBe('9:05 AM');
  });
  it('formats late morning', () => {
    expect(formatClock12h('2026-09-19T08:59:00.000Z')).toBe('11:59 AM');
  });
  it('formats noon as 12:00 PM', () => {
    expect(formatClock12h('2026-09-19T09:00:00.000Z')).toBe('12:00 PM');
    expect(formatClock12h('2026-09-19T09:30:00.000Z')).toBe('12:30 PM');
  });
  it('formats afternoon and night', () => {
    expect(formatClock12h('2026-09-19T14:30:00.000Z')).toBe('5:30 PM');
    expect(formatClock12h('2026-09-18T20:59:00.000Z')).toBe('11:59 PM');
  });
  it('never emits 24-hour times or doubled meridiems', () => {
    for (const iso of ['2026-09-18T21:15:00.000Z', '2026-09-19T05:30:00.000Z', '2026-09-19T10:45:00.000Z']) {
      const out = formatClock12h(iso);
      expect(out).toMatch(/^(1[0-2]|[1-9]):[0-5][0-9] (AM|PM)$/);
    }
  });
  it('returns an em dash for invalid input', () => {
    expect(formatClock12h('not-a-date')).toBe('—');
  });
});

describe('date labels', () => {
  it('formats short and long dates', () => {
    expect(formatShortDate('2026-09-17T20:45:00.000Z')).toBe('Sep 17, 2026');
    expect(formatLongDate('2026-09-19T10:00:00.000Z')).toBe('September 19, 2026');
  });
});

describe('displayDayKey (Africa/Cairo display days)', () => {
  it('keys a 21:05 UTC evening as Sep 19 in Cairo (UTC+3)', () => {
    expect(displayDayKey('2026-09-18T21:05:00.000Z')).toBe('2026-09-19');
  });
  it('keys a 00:05 UTC night as the previous Cairo day', () => {
    expect(displayDayKey('2026-09-19T00:05:00.000Z')).toBe('2026-09-19');
  });
});

describe('bucketDay boundaries', () => {
  // Fixed "now": 2026-09-19 10:00 UTC = 13:00 Cairo.
  const NOW = Date.parse('2026-09-19T10:00:00.000Z');

  it('buckets same-day events as today', () => {
    expect(bucketDay('2026-09-19T00:05:00.000Z', NOW)).toBe('today');
    expect(bucketDay('2026-09-19T09:59:00.000Z', NOW)).toBe('today');
  });
  it('keeps a 23:59 local event in yesterday, not today', () => {
    // 2026-09-18 23:59 Cairo = 20:59 UTC.
    expect(bucketDay('2026-09-18T20:59:00.000Z', NOW)).toBe('yesterday');
  });
  it('keeps a 00:01 local event in today, not yesterday', () => {
    // 2026-09-19 00:01 Cairo = 2026-09-18 21:01 UTC — raw UTC says "18th".
    expect(bucketDay('2026-09-18T21:01:00.000Z', NOW)).toBe('today');
  });
  it('buckets older events as earlier', () => {
    expect(bucketDay('2026-09-17T20:45:00.000Z', NOW)).toBe('earlier');
    expect(bucketDay('2026-09-10T10:00:00.000Z', NOW)).toBe('earlier');
  });
  it('returns null for invalid input', () => {
    expect(bucketDay('garbage', NOW)).toBeNull();
  });
});
