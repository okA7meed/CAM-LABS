import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { Logger } from '../utils/logger';

/**
 * In-process notification event bus.
 *
 * Business events (quote/order created, user registered/signed in, ...) call
 * `publish` after a real notification row exists in the database. Connected
 * Admin SSE clients (see `GET /api/v1/admin/notifications/stream`) receive the
 * event immediately so the Admin bell/badge/dropdown update without a refresh.
 *
 * Single-process deployment: the bus lives in the Express process that writes
 * the notification, so delivery is immediate. Multi-instance deployments would
 * replace this bus with a shared pub/sub transport (Redis) — nothing else in
 * the system is coupled to this module.
 */

export interface AdminNotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  priority: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface SseClient {
  res: ServerResponse<IncomingMessage>;
  alive: boolean;
}

class NotificationEventBus extends EventEmitter {
  private clients = new Set<SseClient>();

  /** Register an SSE response. Returns an unsubscribe function. */
  subscribe(res: ServerResponse<IncomingMessage>): () => void {
    const client: SseClient = { res, alive: true };
    this.clients.add(client);
    const remove = () => {
      if (!client.alive) return;
      client.alive = false;
      this.clients.delete(client);
    };
    res.on('close', remove);
    return remove;
  }

  /** Number of currently connected Admin SSE streams (used by tests). */
  clientCount(): number {
    return this.clients.size;
  }

  /** Drop every connected client (used by tests). */
  clearClients(): void {
    for (const client of this.clients) client.alive = false;
    this.clients.clear();
  }

  private write(client: SseClient, event: string, data: unknown): void {
    if (!client.alive) return;
    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      Logger.warn(`[NotificationEvents] Failed to write SSE frame: ${String(error)}`);
      client.alive = false;
      this.clients.delete(client);
    }
  }

  private broadcast(event: string, data: unknown): void {
    for (const client of this.clients) this.write(client, event, data);
  }

  /** Push a newly created notification to every connected Admin. */
  publish(payload: AdminNotificationEvent): void {
    this.broadcast('notification', payload);
  }
}

export const NotificationEvents = new NotificationEventBus();