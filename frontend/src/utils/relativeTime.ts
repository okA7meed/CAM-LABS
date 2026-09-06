const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

export function formatRelativeTime(iso: string | number | Date, lang = 'en'): string {
  const date = new Date(iso);
  const diff = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  for (const [unit, ms] of UNITS) {
    const amount = Math.round(diff / ms);
    if (Math.abs(diff) >= ms || unit === 'second') {
      return formatter.format(amount, unit);
    }
  }
  return formatter.format(0, 'second');
}