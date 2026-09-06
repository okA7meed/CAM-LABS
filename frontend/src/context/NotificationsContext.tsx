import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { ApiService, ADMIN_NOTIFICATIONS_STREAM } from '../services/api';
import { AdminNotification } from '../types';

const MAX_PREVIEW = 7;
const MAX_RETRY_DELAY = 15_000;

interface NotificationsContextValue {
  notifications: AdminNotification[];
  unread: number;
  loading: boolean;
  streamConnected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const NotificationsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const isAdmin = isAuthenticated && Boolean(currentUser?.role?.includes('ADMIN'));

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [streamConnected, setStreamConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(1000);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [list, count] = await Promise.all([
        ApiService.getAdminNotifications({ limit: MAX_PREVIEW }),
        ApiService.getAdminUnreadCount(),
      ]);
      setNotifications(list?.notifications ?? []);
      setUnread(count?.count ?? 0);
      setError(null);
    } catch {
      setError('notificationStreamError');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const pruneTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const existing = eventSourceRef.current;
    if (existing) {
      existing.close();
      eventSourceRef.current = null;
    }

    const source = new EventSource(ADMIN_NOTIFICATIONS_STREAM, { withCredentials: true });
    eventSourceRef.current = source;

    source.onopen = () => {
      retryDelayRef.current = 1000;
      setStreamConnected(true);
      void refresh();
    };

    source.onerror = () => {
      setStreamConnected(false);
      source.close();
      eventSourceRef.current = null;
      pruneTimers();
      retryTimerRef.current = setTimeout(() => {
        void connect();
      }, retryDelayRef.current);
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY);
    };

    source.addEventListener('notification', (event) => {
      const delivered = event as MessageEvent;
      if (!delivered.data) return;
      try {
        const payload = JSON.parse(delivered.data) as AdminNotification;
        setNotifications((prev) => {
          const next = prev.filter((item) => item.id !== payload.id);
          return [payload, ...next].slice(0, MAX_PREVIEW);
        });
        if (!payload.isRead) setUnread((prev) => prev + 1);
      } catch {
        // ignore malformed frames
      }
    });
  }, [pruneTimers, refresh]);

  useEffect(() => {
    setLoading(true);
    if (!isAdmin) {
      pruneTimers();
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setStreamConnected(false);
      setNotifications([]);
      setUnread(0);
      setLoading(false);
      return undefined;
    }

    void refresh();
    connect();

    const handleFocus = () => void refresh();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      pruneTimers();
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [isAdmin, connect, pruneTimers, refresh]);

  const markRead = useCallback(
    (id: string) => {
      const target = notifications.find((item) => item.id === id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id && !item.isRead ? { ...item, isRead: true, readAt: new Date().toISOString() } : item))
      );
      if (target && !target.isRead) setUnread((prev) => Math.max(0, prev - 1));
      ApiService.markAdminNotificationRead(id).catch(() => undefined);
    },
    [notifications]
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((item) => (item.isRead ? item : { ...item, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnread(0);
    try {
      await ApiService.markAllAdminNotificationsRead();
    } catch {
      // resync via refresh below
    } finally {
      void refresh();
    }
  }, [refresh]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unread,
      loading,
      streamConnected,
      error,
      refresh,
      markRead,
      markAllRead,
    }),
    [notifications, unread, loading, streamConnected, error, refresh, markRead, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = (): NotificationsContextValue => {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
};