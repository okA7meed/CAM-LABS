import { AddressBookEntry, User } from '../../types';

/**
 * Two-letter initials derived safely from the real display name.
 * Ahmed Khaled → AH · John → JO · empty → U · Arabic names keep glyphs.
 */
export function getInitials(name: string | null | undefined): string {
  const trimmed = (name || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'U';
  const chars = Array.from(trimmed);
  if (!trimmed.includes(' ')) return chars.slice(0, 2).join('').toUpperCase();
  const words = trimmed.split(' ');
  const first = Array.from(words[0])[0] || '';
  const last = Array.from(words[words.length - 1])[0] || '';
  return (first + last).toUpperCase();
}

/** Truncates long identifiers (emails) for the sidebar identity card. */
export function truncateMiddle(value: string, max = 22): string {
  if (value.length <= max) return value;
  const keep = Math.max(6, Math.floor((max - 3) / 2));
  return `${value.slice(0, keep)}...${value.slice(value.length - keep)}`;
}

export function getAddressBook(user: User | null | undefined): AddressBookEntry[] {
  const book = user?.preferences?.addressBook;
  return Array.isArray(book) ? book : [];
}

export function getDefaultAddress(user: User | null | undefined): AddressBookEntry | null {
  const book = getAddressBook(user);
  if (!book.length) return null;
  const id = user?.preferences?.defaultAddressId;
  return book.find((a) => a.id === id) ?? book[0] ?? null;
}

export function formatAddressSummary(address: AddressBookEntry): string {
  return [address.street, address.city, address.governorate].filter(Boolean).join(', ');
}

export function formatDefaultAddressLine(user: User | null | undefined): string {
  const def = getDefaultAddress(user);
  if (!def) {
    // Fall back to the legacy single-line profile address (never fabricated).
    return typeof user?.address === 'string' ? user.address : '';
  }
  const parts = [def.street, def.building, def.area, def.city, def.governorate].filter(Boolean);
  return parts.join(', ');
}

export interface ParsedDevice {
  os: string | null;
  browser: string | null;
}

/** Best-effort client + OS labels from a stored user-agent string. Honest fallback included. */
export function parseUserAgent(userAgent: string | null | undefined): ParsedDevice {
  if (!userAgent) return { os: null, browser: null };
  const ua = userAgent.toLowerCase();
  let os: string | null = null;
  if (ua.includes('iphone') || ua.includes('ipad')) os = ua.includes('ipad') ? 'iPadOS' : 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('linux')) os = 'Linux';
  let browser: string | null = null;
  if (ua.includes('edg/') || ua.includes('edge/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('crios')) browser = 'Chrome';
  else if (ua.includes('crios') || (ua.includes('safari/') && !ua.includes('chrome'))) browser = 'Safari';
  else if (ua.includes('firefox/') || ua.includes('fxios')) browser = 'Firefox';
  return { os, browser };
}

/** Privacy-preserving IP display: full IPv4 host part is shown as stored; IPv6 is shortened. */
export function formatIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (!clean) return null;
  if (!clean.includes(':')) return clean;
  // Short forms (e.g. loopback ::1) are shown as-is; longer addresses shorten.
  if (clean.length <= 7) return clean;
  const head = clean.split(':').slice(0, 2).join(':');
  if (!head.replace(/:/g, '')) return clean;
  return `${head}::…`;
}
