/** "23,130,688.23" style presentation formatting — engine precision untouched. */
export const fmtNum = (value: unknown, digits = 2): string => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const fmtEgp = (value: unknown): string => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${fmtNum(n)} EGP`;
};

export const fmtInt = (value: unknown): string => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
};

export const fmtHours = (minutes: unknown): string => {
  const n = typeof minutes === 'number' ? minutes : Number(minutes);
  if (!Number.isFinite(n)) return '—';
  return `${fmtNum(n / 60)} hours`;
};

export const fmtHoursShort = (minutes: unknown): string => {
  const n = typeof minutes === 'number' ? minutes : Number(minutes);
  if (!Number.isFinite(n)) return '—';
  return `${fmtNum(n / 60)} h`;
};

const datePart = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

/** "29 Sep 2026, 12:27:15" — human readable, never raw ISO. */
export const formatQuoteDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return `${datePart.format(date)}, ${timePart.format(date)}`;
};

export interface ExpiryInfo {
  label: string;
  daysLeft: number | null;
  expired: boolean;
}

export const expiryInfoOf = (validUntil?: string | null): ExpiryInfo => {
  if (!validUntil) return { label: '—', daysLeft: null, expired: false };
  const date = new Date(validUntil);
  if (Number.isNaN(date.getTime())) return { label: String(validUntil), daysLeft: null, expired: false };
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  return {
    label: formatQuoteDateTime(validUntil),
    daysLeft,
    expired: daysLeft < 0,
  };
};

/** "392.22 × 227.00 × 1038.00 mm" from {width, depth, height}. */
export const formatDimsMm = (dims: unknown): string => {
  if (!dims || typeof dims !== 'object') return '—';
  const d = dims as Record<string, unknown>;
  const parts = [d.width, d.depth, d.height].map((v) => (typeof v === 'number' && Number.isFinite(v) ? fmtNum(v) : null));
  if (parts.some((p) => p === null)) return '—';
  return `${parts.join(' × ')} mm`;
};
