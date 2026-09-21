import { AdminNotification } from '../types';
import { IconName } from '../components/ui/Icon';

export const notificationIcon = (type: string): IconName => {
  if (type === 'QUOTE') return 'file';
  if (type === 'ORDER') return 'cube';
  if (type === 'USER_REGISTERED' || type === 'USER_LOGIN') return 'users';
  return 'alert';
};

export const notificationPriorityColor = (priority?: string): string => {
  switch (priority) {
    case 'ERROR':
      return '#ef4444';
    case 'WARNING':
      return '#f59e0b';
    case 'SUCCESS':
      return '#10b981';
    default:
      return '#3b82f6';
  }
};

export const notificationTypeLabel = (type: string, t: (key: string) => string): string => {
  const key = `admin.notifications.types.${type}`;
  const translated = t(key);
  return translated === key ? type : translated;
};

export const openNotificationTarget = (
  notification: AdminNotification,
  actions: {
    markRead: (id: string) => void;
    openAdminOrderDetail: (id: string) => void;
    openAdminQuoteDetail: (id: string) => void;
    openAdminCustomerDetail: (id: string) => void;
    openNotificationsPage: () => void;
  }
): void => {
  if (!notification.isRead) actions.markRead(notification.id);
  const entityId = notification.entityId;
  if (notification.type === 'ORDER' && entityId) {
    actions.openAdminOrderDetail(entityId);
  } else if (notification.type === 'QUOTE' && entityId) {
    actions.openAdminQuoteDetail(entityId);
  } else if ((notification.type === 'USER_REGISTERED' || notification.type === 'USER_LOGIN') && entityId) {
    actions.openAdminCustomerDetail(entityId);
  } else if (entityId) {
    actions.openAdminCustomerDetail(entityId);
  } else {
    actions.openNotificationsPage();
  }
};

/* ------------------------------------------------------------------ */
/* Notification Center presentation mapping (centralized).             */
/* Category is derived from the real stored type (+ERROR priority      */
/* escalation); accents/destinations never vary per record.            */
/* ------------------------------------------------------------------ */

export type NotificationCategory =
  | 'quote'
  | 'order'
  | 'customer'
  | 'payment'
  | 'warning'
  | 'system';

export type NotificationAccent = 'blue' | 'green' | 'purple' | 'cyan' | 'amber' | 'gray';

export interface NotificationDestination {
  kind: 'quote' | 'order' | 'customer' | 'payments' | 'manufacturing-requests' | 'materials' | 'audit' | 'none';
  id: string | null;
  /** i18n key for the contextual View action, null when no safe target. */
  viewLabelKey: string | null;
}

/** Real taxonomy observed in production: QUOTE, ORDER, USER_REGISTERED,
 *  USER_LOGIN (+ PAYMENT / SYSTEM / MANUFACTURING_REQUEST / MATERIAL_* when
 *  those events occur; zero such rows exist today). */
export function notificationCategoryOf(notification: Pick<AdminNotification, 'type' | 'priority'>): NotificationCategory {
  if (notification.priority === 'ERROR') return 'warning';
  switch (notification.type) {
    case 'QUOTE':
      return 'quote';
    case 'ORDER':
      return 'order';
    case 'USER_REGISTERED':
    case 'USER_LOGIN':
      return 'customer';
    case 'PAYMENT':
      return 'payment';
    default:
      return 'system';
  }
}

export const NOTIFICATION_CATEGORY_META: Record<
  NotificationCategory,
  { icon: IconName; accent: NotificationAccent }
> = {
  quote: { icon: 'file', accent: 'blue' },
  order: { icon: 'cube', accent: 'green' },
  customer: { icon: 'users', accent: 'purple' },
  payment: { icon: 'card', accent: 'cyan' },
  warning: { icon: 'alert', accent: 'amber' },
  system: { icon: 'gear', accent: 'amber' },
};

/**
 * Canonical business reference for display, in strict priority order:
 *  1. metadata.reference — written at creation by the unified lifecycle.
 *  2. resolvedReference — read-only server enrichment resolving the live
 *     Quote/Order row for historical notifications that predate the unified
 *     model. Never a string transformation, never a rewrite.
 *  3. entityId fallback (order ids are already CAM-shaped; legacy quote
 *     rows without a resolvable record keep their RFQ id honestly).
 * NOTE: metadata.quoteId / metadata.orderId are raw entity keys, NOT display
 * references — they must never shadow resolvedReference.
 */
export function notificationReferenceOf(
  notification: Pick<AdminNotification, 'type' | 'entityId' | 'metadata'> & { resolvedReference?: string | null }
): string | null {
  const meta = (notification.metadata || {}) as Record<string, unknown>;
  const fromMeta = meta.reference;
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta;
  if (typeof notification.resolvedReference === 'string' && notification.resolvedReference.trim()) {
    return notification.resolvedReference;
  }
  return notification.entityId || null;
}

export interface NotificationContext {
  labelKey: string;
  value: string;
}

/** Secondary context column: customer name for user events, reference for
 *  quote/order/payment events, null when nothing meaningful exists. */
export function notificationContextOf(
  notification: Pick<AdminNotification, 'type' | 'entityId' | 'metadata'>
): NotificationContext | null {
  const meta = (notification.metadata || {}) as Record<string, unknown>;
  if (notification.type === 'USER_REGISTERED' || notification.type === 'USER_LOGIN') {
    const name = [meta.customerName, meta.name].find((v) => typeof v === 'string' && (v as string).trim());
    if (typeof name === 'string') return { labelKey: 'admin.notifications.context.customer', value: name };
    return null;
  }
  const ref = notificationReferenceOf(notification);
  if (!ref) return null;
  if (notification.type === 'PAYMENT') return { labelKey: 'admin.notifications.context.reference', value: ref };
  if (notification.type === 'QUOTE' || notification.type === 'ORDER') {
    return { labelKey: 'admin.notifications.context.reference', value: ref };
  }
  return { labelKey: 'admin.notifications.context.reference', value: ref };
}

/**
 * Safe contextual destination. Only entity kinds with a real, existing admin
 * destination are returned; anything else resolves to 'none' (View action
 * hidden) so a deleted/unavailable record can never crash navigation.
 */
export function resolveNotificationDestination(
  notification: Pick<AdminNotification, 'type' | 'entityId' | 'metadata'>
): NotificationDestination {
  const entityId = notification.entityId || null;
  switch (notification.type) {
    case 'QUOTE':
      return entityId
        ? { kind: 'quote', id: entityId, viewLabelKey: 'admin.notifications.view.quote' }
        : { kind: 'none', id: null, viewLabelKey: null };
    case 'ORDER':
      return entityId
        ? { kind: 'order', id: entityId, viewLabelKey: 'admin.notifications.view.order' }
        : { kind: 'none', id: null, viewLabelKey: null };
    case 'USER_REGISTERED':
    case 'USER_LOGIN':
      return entityId
        ? { kind: 'customer', id: entityId, viewLabelKey: 'admin.notifications.view.customer' }
        : { kind: 'none', id: null, viewLabelKey: null };
    case 'PAYMENT':
      return { kind: 'payments', id: null, viewLabelKey: 'admin.notifications.view.payment' };
    case 'MANUFACTURING_REQUEST':
      return { kind: 'manufacturing-requests', id: null, viewLabelKey: 'admin.notifications.view.manufacturing' };
    default: {
      const meta = (notification.metadata || {}) as Record<string, unknown>;
      if (typeof meta.materialId === 'string' || /material/i.test(notification.type)) {
        return { kind: 'materials', id: null, viewLabelKey: 'admin.notifications.view.materials' };
      }
      return { kind: 'none', id: null, viewLabelKey: null };
    }
  }
}