import { ViewType } from '../types';

/**
 * Hash routing for the CAM LABS single-page shell.
 *
 * The app has no URL router (navigation is `activeView` state), so browser
 * refresh, direct links, and Back/Forward previously collapsed to the landing
 * page. This module is the smallest safe improvement: every top-level view
 * maps to a stable `#/...` hash, and Account Settings sub-sections map to
 * `#/account/<section>`. Transient selections (admin detail rows, modals,
 * order timeline) intentionally stay out of the URL and resolve to their
 * parent list hash.
 *
 * - `setActiveView` (StoreContext) writes hashes with `pushState` so
 *   Back/Forward step through real navigation.
 * - A `hashchange` listener maps hashes back to view state (direct access,
 *   refresh, Back/Forward).
 * - Unknown hashes resolve to null and never clobber current state.
 */

export type AccountSection = 'personal' | 'addresses' | 'security' | 'notifications';

export const ACCOUNT_SECTIONS: AccountSection[] = ['personal', 'addresses', 'security', 'notifications'];

export const isAccountSection = (value: unknown): value is AccountSection =>
  value === 'personal' || value === 'addresses' || value === 'security' || value === 'notifications';

/** Stable hash per view. Detail views share their parent list hash. */
const VIEW_HASHES: Partial<Record<ViewType, string>> = {
  home: '/',
  dashboard: '/dashboard',
  orders: '/orders',
  profile: '/account',
  marketplace: '/marketplace',
  'manufacturing-request': '/manufacturing-request',
  'submit-quote': '/submit-quote',
  'quote-success': '/quote-success',
  'coming-soon': '/coming-soon',
  'equation-builder': '/equation-builder',
  quotes: '/quotes',
  shipping: '/shipping',
  contact: '/contact',
  faq: '/faq',
  privacy: '/privacy',
  terms: '/terms',
  nda: '/nda',
  security: '/security',
  'not-found': '/not-found',
  'admin-dashboard': '/admin',
  'admin-orders': '/admin/orders',
  'admin-order-detail': '/admin/orders',
  'admin-customers': '/admin/customers',
  'admin-customer-detail': '/admin/customers',
  'admin-manufacturers': '/admin/manufacturers',
  'admin-manufacturer-detail': '/admin/manufacturers',
  'admin-manufacturing-requests': '/admin/manufacturing-requests',
  'admin-manufacturing-request-detail': '/admin/manufacturing-requests',
  'admin-materials': '/admin/materials',
  'admin-quotes': '/admin/quotes',
  'admin-quote-detail': '/admin/quotes',
  'admin-deletion-requests': '/admin/deletion-requests',
  'admin-discount-codes': '/admin/discount-codes',
  'admin-discount-code-detail': '/admin/discount-codes',
  'admin-cad-files': '/admin/cad-files',
  'admin-cad-file-detail': '/admin/cad-files',
  'admin-payments': '/admin/payments',
  'admin-shipping': '/admin/shipping',
  'admin-pricing': '/admin/pricing',
  'admin-pricing-constants': '/admin/pricing',
  'admin-reports': '/admin/reports',
  'admin-notifications': '/admin/notifications',
  'admin-users': '/admin/users',
  'admin-audit-logs': '/admin/audit-logs',
  'admin-settings': '/admin/settings',
};

const HASH_VIEWS: Record<string, ViewType> = {
  '/': 'home',
  '/dashboard': 'dashboard',
  '/orders': 'orders',
  '/account': 'profile',
  '/marketplace': 'marketplace',
  '/manufacturing-request': 'manufacturing-request',
  '/submit-quote': 'submit-quote',
  '/quote-success': 'quote-success',
  '/coming-soon': 'coming-soon',
  '/equation-builder': 'equation-builder',
  '/quotes': 'quotes',
  '/shipping': 'shipping',
  '/contact': 'contact',
  '/faq': 'faq',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/nda': 'nda',
  '/security': 'security',
  '/not-found': 'not-found',
  '/admin': 'admin-dashboard',
  '/admin/orders': 'admin-orders',
  '/admin/customers': 'admin-customers',
  '/admin/manufacturers': 'admin-manufacturers',
  '/admin/manufacturing-requests': 'admin-manufacturing-requests',
  '/admin/materials': 'admin-materials',
  '/admin/quotes': 'admin-quotes',
  '/admin/deletion-requests': 'admin-deletion-requests',
  '/admin/discount-codes': 'admin-discount-codes',
  '/admin/cad-files': 'admin-cad-files',
  '/admin/payments': 'admin-payments',
  '/admin/shipping': 'admin-shipping',
  '/admin/pricing': 'admin-pricing',
  '/admin/reports': 'admin-reports',
  '/admin/notifications': 'admin-notifications',
  '/admin/users': 'admin-users',
  '/admin/audit-logs': 'admin-audit-logs',
  '/admin/settings': 'admin-settings',
};

/** Full hash for a view, e.g. `#/account/addresses`. */
export function viewToHash(view: ViewType, accountSection?: AccountSection): string {
  const base = VIEW_HASHES[view];
  if (!base) return '';
  if (view === 'profile' && accountSection && accountSection !== 'personal') {
    return `#${base}/${accountSection}`;
  }
  return `#${base}`;
}

export interface ParsedHash {
  view: ViewType;
  accountSection: AccountSection;
}

/** Parses the current (or given) location hash. Null when unrecognized. */
export function parseHash(hash?: string): ParsedHash | null {
  const raw = (hash ?? (typeof window !== 'undefined' ? window.location.hash : '')).replace(/^#/, '');
  if (!raw || raw === '/') return { view: 'home', accountSection: 'personal' };
  // Tolerate both `#/dashboard` (canonical, written by viewToHash) and
  // `#dashboard` (hand-typed links, copied nav hrefs).
  const slashed = raw.startsWith('/') ? raw : `/${raw}`;
  const match = slashed.match(/^\/account(?:\/([a-z-]+))?\/?$/);
  if (match) {
    const section = match[1];
    if (section === undefined) return { view: 'profile', accountSection: 'personal' };
    if (isAccountSection(section)) return { view: 'profile', accountSection: section };
    return null;
  }
  const normalized = slashed.endsWith('/') && slashed.length > 1 ? slashed.slice(0, -1) : slashed;
  const view = HASH_VIEWS[normalized];
  return view ? { view, accountSection: 'personal' } : null;
}

/** Writes a view hash (push for Back/Forward support, replace when asked). */
export function writeHash(view: ViewType, accountSection?: AccountSection, replace = false): void {
  try {
    const hash = viewToHash(view, accountSection);
    if (!hash || window.location.hash === hash) return;
    if (replace) {
      window.history.replaceState(null, '', hash);
    } else {
      window.history.pushState(null, '', hash);
    }
  } catch {
    /* ignore history errors (private mode, tests) */
  }
}

/**
 * Leaves a real server-routed pathname (`/admin`) while preserving the view
 * hash. All nav chrome must use this instead of a bare `pushState('/')`.
 */
export function resetPathname(): void {
  try {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', `/${window.location.hash}`);
    }
  } catch {
    /* ignore history errors */
  }
}

/** Enters the server-routed `/admin` pathname while preserving the hash. */
export function enterAdminPath(): void {
  try {
    if (window.location.pathname !== '/admin') {
      window.history.pushState({}, '', `/admin${window.location.hash}`);
    }
  } catch {
    /* ignore history errors */
  }
}
