import { IconName } from '../components/ui/Icon';
import { ViewType } from '../types';

export interface AdminNavItem {
  view: ViewType;
  labelKey: string;
  icon: IconName;
}

export interface AdminNavGroup {
  id: string;
  labelKey: string;
  items: AdminNavItem[];
}

/**
 * Admin sidebar information architecture. View keys are stable routing
 * identifiers — labels and icons may evolve without touching navigation.
 *
 * Grouping mirrors the manufacturing operations flow:
 * OVERVIEW → ORDERS & CUSTOMERS → MANUFACTURING → COMMERCE → SYSTEM.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'overview',
    labelKey: 'admin.navGroup.overview',
    items: [{ view: 'admin-dashboard', labelKey: 'admin.nav.dashboard', icon: 'home' }],
  },
  {
    id: 'orders-customers',
    labelKey: 'admin.navGroup.ordersCustomers',
    items: [
      { view: 'admin-orders', labelKey: 'admin.nav.orders', icon: 'package' },
      { view: 'admin-quotes', labelKey: 'admin.nav.quotes', icon: 'file' },
      { view: 'admin-deletion-requests', labelKey: 'admin.nav.deletionRequests', icon: 'trash' },
      { view: 'admin-customers', labelKey: 'admin.nav.customers', icon: 'users' },
      { view: 'admin-cad-files', labelKey: 'admin.nav.cadFiles', icon: 'cube' },
    ],
  },
  {
    id: 'manufacturing',
    labelKey: 'admin.navGroup.manufacturing',
    items: [
      { view: 'admin-manufacturing-requests', labelKey: 'admin.nav.manufacturingRequests', icon: 'gear' },
      { view: 'admin-manufacturers', labelKey: 'admin.nav.manufacturers', icon: 'factory' },
      { view: 'admin-materials', labelKey: 'admin.nav.materials', icon: 'database' },
      { view: 'admin-shipping', labelKey: 'admin.nav.shipping', icon: 'truck' },
    ],
  },
  {
    id: 'commerce',
    labelKey: 'admin.navGroup.commerce',
    items: [
      { view: 'admin-pricing', labelKey: 'admin.nav.pricing', icon: 'calculator' },
      { view: 'admin-discount-codes', labelKey: 'admin.nav.discountCodes', icon: 'coupon' },
      { view: 'admin-payments', labelKey: 'admin.nav.payments', icon: 'card' },
      { view: 'admin-reports', labelKey: 'admin.nav.reports', icon: 'chart' },
    ],
  },
  {
    id: 'system',
    labelKey: 'admin.navGroup.system',
    items: [
      { view: 'admin-notifications', labelKey: 'admin.nav.notifications', icon: 'bell' },
      { view: 'admin-users', labelKey: 'admin.nav.adminUsers', icon: 'userGear' },
      { view: 'admin-audit-logs', labelKey: 'admin.nav.auditLogs', icon: 'fileClock' },
      { view: 'admin-settings', labelKey: 'admin.nav.settings', icon: 'sliders' },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
