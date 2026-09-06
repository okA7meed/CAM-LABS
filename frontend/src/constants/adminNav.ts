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

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'overview',
    labelKey: 'admin.navGroup.overview',
    items: [{ view: 'admin-dashboard', labelKey: 'admin.nav.dashboard', icon: 'layers' }],
  },
  {
    id: 'orders',
    labelKey: 'admin.navGroup.orders',
    items: [
      { view: 'admin-orders', labelKey: 'admin.nav.orders', icon: 'layers3' },
      { view: 'admin-quotes', labelKey: 'admin.nav.quotes', icon: 'file' },
      { view: 'admin-customers', labelKey: 'admin.nav.customers', icon: 'technology' },
      { view: 'admin-cad-files', labelKey: 'admin.nav.cadFiles', icon: 'cube' },
    ],
  },
  {
    id: 'supply',
    labelKey: 'admin.navGroup.supplyChain',
    items: [
      { view: 'admin-manufacturers', labelKey: 'admin.nav.manufacturers', icon: 'precision' },
      { view: 'admin-manufacturing-requests', labelKey: 'admin.nav.manufacturingRequests', icon: 'cpu' },
      { view: 'admin-materials', labelKey: 'admin.nav.materials', icon: 'database' },
    ],
  },
  {
    id: 'commerce',
    labelKey: 'admin.navGroup.commerce',
    items: [
      { view: 'admin-pricing', labelKey: 'admin.nav.pricing', icon: 'gear' },
      { view: 'admin-payments', labelKey: 'admin.nav.payments', icon: 'clipboard' },
      { view: 'admin-reports', labelKey: 'admin.nav.reports', icon: 'review' },
    ],
  },
  {
    id: 'system',
    labelKey: 'admin.navGroup.system',
    items: [
      { view: 'admin-notifications', labelKey: 'admin.nav.notifications', icon: 'alert' },
      { view: 'admin-shipping', labelKey: 'admin.nav.shipping', icon: 'send' },
      { view: 'admin-users', labelKey: 'admin.nav.adminUsers', icon: 'eye' },
      { view: 'admin-audit-logs', labelKey: 'admin.nav.auditLogs', icon: 'clock' },
      { view: 'admin-settings', labelKey: 'admin.nav.settings', icon: 'configure' },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);