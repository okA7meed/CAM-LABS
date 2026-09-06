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