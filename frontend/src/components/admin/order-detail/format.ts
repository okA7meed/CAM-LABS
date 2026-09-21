const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "Sep 14, 2026, 14:32" -> "Sep 14, 2026 • 14:32" (target design separator). */
export const formatPlacedOn = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return dateTimeFmt.format(date).replace(',', ' •').replace(', ', ' • ');
};

export const formatShortDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return dateFmt.format(date);
};

export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return dateTimeFmt.format(date);
};

/** Extract the stored currency code ("1,252.09 EGP" -> "EGP"). */
export const extractCurrency = (totalCost?: string | null): string => {
  const match = String(totalCost || '').match(/[A-Z]{3}/);
  return match ? match[0] : 'EGP';
};

export const initialsOf = (name?: string | null, email?: string | null): string => {
  const source = (name || '').trim() || (email || '').trim();
  if (!source) return '•';
  const parts = source.replace(/[@._-]+/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const SPEC_TEXT_OVERRIDES: Record<string, string> = {
  pla: 'PLA',
  abs: 'ABS',
  petg: 'PETG',
  tpu: 'TPU',
  fdm: 'FDM',
  sla: 'SLA',
  sls: 'SLS',
  any: 'Any',
  standard: 'Standard',
  sparse: 'Sparse',
  solid: 'Solid',
  printing: '3D Printing',
  milling: 'CNC Milling',
  turning: 'CNC Turning',
};

/** Humanize a stored spec value — never emits null/undefined/[object Object]. */
export const humanizeSpecValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'Not specified';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Not specified';
  if (typeof value === 'object') return 'Not specified';
  const text = String(value).trim();
  if (!text) return 'Not specified';
  const lower = text.toLowerCase();
  if (SPEC_TEXT_OVERRIDES[lower]) return SPEC_TEXT_OVERRIDES[lower];
  if (lower === 'true') return 'Enabled';
  if (lower === 'false') return 'Disabled';
  if (lower === 'null' || lower === 'undefined') return 'Not specified';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** "shippingMethod" -> "Shipping Method", "wallCount" -> "Wall Count". */
export const humanizeKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const copyText = async (text: string): Promise<boolean> => {
  const value = String(text || '');
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
};

export const escapeHtml = (value: string): string =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
