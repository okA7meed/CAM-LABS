import { getPrismaClient } from '../config/database';
import { Prisma } from '@prisma/client';
import { Logger } from '../utils/logger';
import { ROLES } from '../auth/roles';
import { AppError } from '../utils/errors';
import { NotificationEvents } from './notification-events.service';

/**
 * Admin Service
 * 
 * Handles admin-specific operations including:
 * - Admin user management
 * - Audit logging
 * - Admin notifications
 * - System settings
 */

export interface AuditLogData {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  metadata?: any;
}

export interface CreateNotificationData {
  userId?: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  priority?: string;
  entityType?: string;
  entityId?: string;
}

export const ADMIN_ROLE_VALUES = ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'PRICING_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN'];

/** Orders that have entered (or passed) the production stage. */
export const PRODUCTION_STAGE_STATUSES = ['Delivered', 'In Production', 'Quality Inspection'];

/** Platform default timezone (configured in system settings). */
export const CAIRO_TIME_ZONE = 'Africa/Cairo';

/** Cairo offset in ms — computed at runtime because Egypt observes DST. */
export const cairoOffsetMs = (() => {
  const part = (tz: string, unit: 'hour' | 'minute'): number =>
    Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, [unit]: '2-digit', hour12: false }).format(new Date()));
  return (part(CAIRO_TIME_ZONE, 'hour') * 60 + part(CAIRO_TIME_ZONE, 'minute') - (part('UTC', 'hour') * 60 + part('UTC', 'minute'))) * 60_000;
})();

/** Format a Date as its calendar day in the Cairo timezone (YYYY-MM-DD). */
export const cairoDayKey = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: CAIRO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** Convert a Cairo calendar day (YYYY-MM-DD) to its UTC midnight instant. */
export const cairoDayToUtc = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - cairoOffsetMs);
};

/** Parse a currency-string order total (e.g. "7,284.51 EGP") into a number. */
export const parseOrderCost = (value?: string | null): number => {
  if (!value) return 0;
  return parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
};

export class AdminService {
  /**
   * Create an audit log entry
   */
  static async createAuditLog(data: AuditLogData): Promise<void> {
    try {
      await getPrismaClient().auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          oldValue: data.oldValue as Prisma.InputJsonValue,
          newValue: data.newValue as Prisma.InputJsonValue,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          sessionId: data.sessionId,
          metadata: data.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      Logger.error(`[AdminService] Failed to create audit log: ${error}`);
    }
  }

  /**
   * Get audit logs with filtering
   */
  static async getAuditLogs(filters: {
    userId?: string;
    entityType?: string;
    action?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const prisma = getPrismaClient();
    const { userId, entityType, action, search, startDate, endDate, limit = 50, offset = 0 } = filters;

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (search) {
      const q = search;
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total, stats: { totalLogs: total } };
  }

  /**
   * Create admin notification
   *
   * Only REAL business events should call this (quote created, order created,
   * user registered, user signed in, ...) — never plain API access. After the
   * row is committed the in-process event bus pushes a real-time update to
   * every connected Admin SSE client.
   */
  static async createNotification(data: CreateNotificationData) {
    const notification = await getPrismaClient().adminNotification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata as Prisma.InputJsonValue,
        priority: data.priority || 'INFO',
        entityType: data.entityType,
        entityId: data.entityId,
      },
    });
    NotificationEvents.publish(AdminService.notificationEventPayload(notification));
    return notification;
  }

  /**
   * Fire-and-forget notification creation for business events. Notification
   * failures must never break the underlying customer flow (quote/order/auth),
   * so any error is logged and swallowed.
   */
  static async notifySafely(data: CreateNotificationData): Promise<void> {
    try {
      await AdminService.createNotification(data);
    } catch (error) {
      Logger.error(`[AdminService] Failed to create notification: ${String(error)}`);
    }
  }

  /** Compact client-safe payload pushed over the SSE stream. */
  static notificationEventPayload(notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    entityType?: string | null;
    entityId?: string | null;
    isRead?: boolean;
    priority: string;
    createdAt: Date;
    metadata?: any;
  }) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType ?? null,
      entityId: notification.entityId ?? null,
      isRead: notification.isRead ?? false,
      priority: notification.priority,
      createdAt: notification.createdAt.toISOString(),
      metadata: notification.metadata ?? null,
    };
  }

  /**
   * Get notifications for admin users.
   *
   * Scoped to the authenticated admin when a userId is provided. Supports
   * pagination (`limit`/`offset` — the dropdown passes limit=7), type filtering
   * and an unread-only filter. Always newest first.
   */
  static async getNotifications(userId?: string, options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    type?: string;
  } = {}) {
    const prisma = getPrismaClient();
    const { unreadOnly, type } = options;
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 500);
    const offset = Math.max(Number(options.offset) || 0, 0);
    const where: Prisma.AdminNotificationWhereInput = {};

    // Global notifications (userId null) are visible to every admin; per-admin
    // notifications only to their owner. Cross-admin isolation is preserved.
    if (userId) where.OR = [{ userId: null }, { userId }];
    if (unreadOnly) where.isRead = false;
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.adminNotification.count({ where }),
    ]);

    return { notifications, total };
  }

  /** Fetch a single notification visible to the given admin (own or global). */
  static async getNotificationById(notificationId: string, userId?: string) {
    const where: Prisma.AdminNotificationWhereInput = { id: notificationId };
    if (userId) where.OR = [{ userId: null }, { userId }];
    return getPrismaClient().adminNotification.findFirst({ where });
  }

  /**
   * Mark a notification as read. Scoped to the owning admin so any admin can
   * never mark another admin's notification (no cross-administrator writes).
   * Returns null when the notification is not found / not owned.
   */
  static async markNotificationRead(notificationId: string, userId?: string) {
    const filter: Prisma.AdminNotificationWhereInput = { id: notificationId };
    if (userId) filter.OR = [{ userId: null }, { userId }];
    const result = await getPrismaClient().adminNotification.updateMany({
      where: filter,
      data: { isRead: true, readAt: new Date() },
    });
    if (result.count === 0) return null;
    return getPrismaClient().adminNotification.findUnique({ where: { id: notificationId } });
  }

  /** Mark every unread notification visible to the authenticated admin as read. */
  static async markAllNotificationsRead(userId: string) {
    const filter: Prisma.AdminNotificationWhereInput = {
      isRead: false,
      OR: [{ userId: null }, { userId }],
    };
    return getPrismaClient().adminNotification.updateMany({
      where: filter,
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Count unread notifications visible to the authenticated admin (global +
   * own). This is the single source of truth for the header badge: it reflects
   * only real unread AdminNotification rows (never hardcoded, never synthetic).
   */
  static async countUnreadNotifications(userId?: string): Promise<number> {
    const where: Prisma.AdminNotificationWhereInput = { isRead: false };
    if (userId) where.OR = [{ userId: null }, { userId }];
    return getPrismaClient().adminNotification.count({ where });
  }

  /**
   * Create admin user
   */
  static async createAdminUser(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    company?: string;
    phone?: string;
    notes?: string;
  }) {
    const { hashPassword } = await import('../auth/password.service');
    
    const user = await getPrismaClient().user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: await hashPassword(data.password),
        role: data.role,
        isAdmin: true,
        company: data.company || 'CAM LABS',
        phone: data.phone,
        adminNotes: data.notes,
        accountStatus: 'ACTIVE',
      },
    });

    // Create audit log (without userId for bootstrap context)
    await this.createAuditLog({
      action: 'CREATE',
      entityType: 'USER',
      entityId: user.id,
      newValue: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        isAdmin: true 
      },
      metadata: { source: 'bootstrap-script' },
    });

    return user;
  }

  /**
   * Get all admin users
   */
  static async getAdminUsers() {
    return getPrismaClient().user.findMany({
      where: {
        isAdmin: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        company: true,
        phone: true,
        adminNotes: true,
        lastActivityAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update admin user
   */
  static async updateAdminUser(userId: string, data: {
    name?: string;
    role?: string;
    accountStatus?: string;
    adminNotes?: string;
  }) {
    const existingUser = await getPrismaClient().user.findUnique({
      where: { id: userId },
    });

    // This endpoint manages ADMIN accounts. Regular customers must never be
    // writable through it — role changes here would otherwise grant the
    // rank-based RBAC gates to non-admin users.
    if (!existingUser || !existingUser.isAdmin) {
      throw new AppError('Admin user not found', 404, 'NOT_FOUND');
    }

    const updatedUser = await getPrismaClient().user.update({
      where: { id: userId },
      data,
    });

    // Create audit log
    await this.createAuditLog({
      action: 'UPDATE',
      entityType: 'USER',
      entityId: userId,
      oldValue: { 
        name: existingUser.name, 
        role: existingUser.role, 
        accountStatus: existingUser.accountStatus 
      },
      newValue: { 
        name: updatedUser.name, 
        role: updatedUser.role, 
        accountStatus: updatedUser.accountStatus 
      },
    });

    return updatedUser;
  }

  /**
   * Reset admin user password
   */
  static async resetAdminPassword(userId: string, newPassword: string) {
    const { hashPassword } = await import('../auth/password.service');

    const existingUser = await getPrismaClient().user.findUnique({ where: { id: userId } });
    // Password reset belongs to admin account management (see updateAdminUser).
    if (!existingUser || !existingUser.isAdmin) {
      throw new AppError('Admin user not found', 404, 'NOT_FOUND');
    }

    const user = await getPrismaClient().user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(newPassword),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // A reset credential must invalidate every session already issued for the
    // account — otherwise a compromised admin keeps live access after the reset.
    await getPrismaClient().session.deleteMany({ where: { userId } });

    // Create audit log (without password)
    await this.createAuditLog({
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: userId,
      newValue: { id: userId, email: user.email },
    });

    return user;
  }

  /**
   * Get dashboard statistics.
   *
   * Aggregations run server-side against the database. Every number is real:
   * counts come from the underlying entities and revenue follows the same
   * definition as the Revenue report (sum of production-stage order totals).
   * An optional `range` (7 | 30 | 90 | "year") drives the order-overview
   * timeline; sparkline trends always cover the latest 30 calendar days.
   */
  static async getDashboardStats(range?: string) {
    const prisma = getPrismaClient();

    const requested = Number(range);
    const days = requested === 30 || requested === 90 ? requested : 7;
    const isYear = range === 'year';

    // Cairo-calendar window helpers (platform default timezone).
    const cairoTodayKey = cairoDayKey(new Date());
    const cairoStartKey = isYear
      ? `${cairoTodayKey.slice(0, 4)}-01-01`
      : cairoDayKey(new Date(Date.now() + cairoOffsetMs - (days - 1) * 86_400_000));
    const keyList = (fromKey: string, toKey: string): string[] => {
      const keys: string[] = [];
      const cursor = cairoDayToUtc(fromKey);
      const endAt = cairoDayToUtc(toKey);
      while (cursor.getTime() <= endAt.getTime()) {
        keys.push(cairoDayKey(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return keys;
    };
    const rangeKeys = keyList(cairoStartKey, cairoTodayKey);

    const [
      totalOrders,
      pendingOrders,
      inProductionOrders,
      qualityInspectionOrders,
      completedOrders,
      cancelledOrders,
      totalCustomers,
      totalQuotes,
      activeQuotes,
      approvedQuotes,
      totalCadFiles,
      totalManufacturers,
      activeManufacturers,
      pendingManufacturingRequests,
      acceptedManufacturingRequests,
      inProgressManufacturingRequests,
      completedManufacturingRequests,
      dbPing,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'In Review' } }),
      prisma.order.count({ where: { status: 'In Production' } }),
      prisma.order.count({ where: { status: 'Quality Inspection' } }),
      prisma.order.count({ where: { status: 'Delivered' } }),
      prisma.order.count({ where: { status: 'Cancelled' } }),
      prisma.user.count({ where: { accountStatus: 'ACTIVE', role: { notIn: ADMIN_ROLE_VALUES } } }),
      prisma.quote.count(),
      prisma.quote.count({ where: { status: 'Ready for Approval' } }),
      prisma.quote.count({ where: { status: 'Approved' } }),
      prisma.cadFile.count(),
      prisma.manufacturer.count(),
      prisma.manufacturer.count({ where: { status: 'ACTIVE' } }),
      prisma.manufacturingRequest.count({ where: { status: 'PENDING' } }),
      prisma.manufacturingRequest.count({ where: { status: 'ACCEPTED' } }),
      prisma.manufacturingRequest.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.manufacturingRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.$queryRawUnsafe('SELECT 1 AS ok'),
    ]);

    // Revenue — application financial model (mirrors the Revenue report):
    // sum of totalCost across orders at production stage.
    const revenueOrders = await prisma.order.findMany({
      where: { status: { in: PRODUCTION_STAGE_STATUSES } },
      select: { totalCost: true, createdAt: true },
    });
    const totalRevenue = revenueOrders.reduce((sum, order) => sum + parseOrderCost(order.totalCost), 0);

    // Recent platform activity (real Audit Log entries).
    const recentAudit = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: { select: { name: true, role: true } } },
    });
    const activity = recentAudit.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actor: entry.user?.name ?? null,
      createdAt: entry.createdAt,
    }));

    // Order-overview timeline for the selected range.
    const timelineOrders = await prisma.order.findMany({
      where: { createdAt: { gte: cairoDayToUtc(cairoStartKey) }, status: { not: 'Cancelled' } },
      select: { createdAt: true },
    });
    const ordersByDay = new Map<string, number>();
    for (const order of timelineOrders) {
      const key = cairoDayKey(order.createdAt);
      ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1);
    }
    const orderTimeline = rangeKeys.map((date) => ({ date, orders: ordersByDay.get(date) ?? 0 }));

    // Sparkline trends — real records grouped by day over the last 30 calendar days.
    const trendStartKey = cairoDayKey(new Date(Date.now() + cairoOffsetMs - 29 * 86_400_000));
    const trendKeys = keyList(trendStartKey, cairoTodayKey);
    const bucketize = <T,>(rows: T[], key: (row: T) => string, pick: (row: T) => number): number[] => {
      const counts = new Map<string, number>();
      for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + pick(row));
      return trendKeys.map((k) => counts.get(k) ?? 0);
    };

    const [allOrders, allCustomers, allQuotes, allCadFiles, allManufacturers] = await Promise.all([
      prisma.order.findMany({ select: { createdAt: true } }),
      prisma.user.findMany({ where: { accountStatus: 'ACTIVE', role: { notIn: ADMIN_ROLE_VALUES } }, select: { createdAt: true } }),
      prisma.quote.findMany({ select: { createdAt: true } }),
      prisma.cadFile.findMany({ select: { createdAt: true } }),
      prisma.manufacturer.findMany({ select: { createdAt: true } }),
    ]);

    const trends = {
      orders: bucketize(allOrders, (row) => cairoDayKey(row.createdAt), () => 1),
      revenue: bucketize(revenueOrders, (row) => cairoDayKey(row.createdAt), (row) => parseOrderCost(row.totalCost)),
      customers: bucketize(allCustomers, (row) => cairoDayKey(row.createdAt), () => 1),
      quotes: bucketize(allQuotes, (row) => cairoDayKey(row.createdAt), () => 1),
      cadFiles: bucketize(allCadFiles, (row) => cairoDayKey(row.createdAt), () => 1),
      manufacturers: bucketize(allManufacturers, (row) => cairoDayKey(row.createdAt), () => 1),
    };

    const databaseOperational = Array.isArray(dbPing) && dbPing.length > 0 && (dbPing[0] as { ok?: number })?.ok === 1;

    return {
      range: isYear ? 'year' : days,
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        inProduction: inProductionOrders,
        qualityInspection: qualityInspectionOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
      },
      customers: { total: totalCustomers },
      quotes: { total: totalQuotes, active: activeQuotes, approved: approvedQuotes },
      cadFiles: { total: totalCadFiles },
      manufacturers: { total: totalManufacturers, active: activeManufacturers },
      manufacturingRequests: {
        pending: pendingManufacturingRequests,
        accepted: acceptedManufacturingRequests,
        inProgress: inProgressManufacturingRequests,
        completed: completedManufacturingRequests,
      },
      revenue: { total: totalRevenue, currency: 'EGP', orderCount: revenueOrders.length },
      pendingActions: {
        manufacturingRequests: pendingManufacturingRequests,
        orders: pendingOrders,
        quotes: activeQuotes,
        total: pendingManufacturingRequests + pendingOrders + activeQuotes,
      },
      system: {
        database: databaseOperational ? 'OPERATIONAL' : 'DEGRADED',
        platform: databaseOperational ? 'OPERATIONAL' : 'DEGRADED',
      },
      trends,
      orderTimeline,
      activity,
    };
  }

  static async getSystemSetting<T = unknown>(key: string): Promise<T | null> {
    const setting = await getPrismaClient().systemSetting.findUnique({ where: { key } });
    return (setting?.value as T | null) ?? null;
  }

  static async upsertSystemSetting(params: {
    key: string;
    group: string;
    value: Prisma.InputJsonValue;
    description?: string;
    updatedBy?: string;
  }) {
    return getPrismaClient().systemSetting.upsert({
      where: { key: params.key },
      create: {
        key: params.key,
        group: params.group,
        value: params.value,
        description: params.description,
        updatedBy: params.updatedBy,
      },
      update: {
        group: params.group,
        value: params.value,
        description: params.description,
        updatedBy: params.updatedBy,
      },
    });
  }

  static async getSettingsSnapshot() {
    const prisma = getPrismaClient();
    const settings = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });

    const asObject = settings.reduce<Record<string, any>>((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    return {
      general: {
        companyName: asObject.companyName ?? 'CAM LABS',
        supportEmail: asObject.supportEmail ?? 'support@cam-labs.com',
        currency: asObject.currency ?? 'EGP',
        timezone: asObject.timezone ?? 'Africa/Cairo',
        platformFee: asObject.platformFee ?? 0,
        platformFeeLabel: '0% (No platform fee)',
      },
      admin: {
        adminUrl: asObject.adminUrl ?? '/admin',
        totalAdminUsers: await prisma.user.count({ where: { isAdmin: true } }),
        roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN', 'PRICING_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN'],
      },
      system: {
        totalUsers: await prisma.user.count(),
        totalOrders: await prisma.order.count(),
        totalManufacturers: await prisma.manufacturer.count(),
        totalMaterials: await prisma.material.count(),
        databaseConnected: true,
      },
      upload: {
        allowedFormats: asObject.allowedFormats ?? ['STEP', 'STP', 'STL', 'OBJ', 'PLY', 'DXF', 'SVG', 'PDF', 'IGES', 'IGS'],
        maxFileSize: asObject.maxFileSize ?? 100,
        processingEnabled: asObject.processingEnabled ?? true,
        validationEnabled: asObject.validationEnabled ?? true,
      },
      manufacturing: {
        technologies: asObject.technologies ?? ['FDM', 'SLA', 'SLS', 'CNC_MILLING', 'CNC_TURNING', 'LASER_CUTTING'],
        autoAssignEnabled: asObject.autoAssignEnabled ?? true,
        qualityCheckEnabled: asObject.qualityCheckEnabled ?? true,
      },
      notifications: {
        customerNotifications: asObject.customerNotifications ?? true,
        adminNotifications: asObject.adminNotifications ?? true,
        emailNotifications: asObject.emailNotifications ?? true,
      },
    };
  }

  /**
   * Check if user has specific admin permission
   */
  static hasAdminPermission(userRole: string, requiredPermission: string): boolean {
    const adminRoles = [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
      ROLES.OPERATIONS_ADMIN,
      ROLES.PRICING_ADMIN,
      ROLES.SUPPORT_ADMIN,
      ROLES.FINANCE_ADMIN,
    ];

    if (!adminRoles.includes(userRole as any)) {
      return false;
    }

    // Super Admin has all permissions
    if (userRole === ROLES.SUPER_ADMIN) {
      return true;
    }

    // Role-based permissions
    const rolePermissions: Record<string, string[]> = {
      [ROLES.OPERATIONS_ADMIN]: ['orders', 'manufacturing', 'manufacturers', 'shipping'],
      [ROLES.PRICING_ADMIN]: ['pricing', 'materials', 'equations'],
      [ROLES.SUPPORT_ADMIN]: ['customers', 'orders', 'quotes'],
      [ROLES.FINANCE_ADMIN]: ['payments', 'revenue'],
      [ROLES.ADMIN]: ['*'], // Full admin access
    };

    const permissions = rolePermissions[userRole] || [];
    return permissions.includes('*') || permissions.includes(requiredPermission);
  }
}