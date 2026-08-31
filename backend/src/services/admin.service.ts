import { getPrismaClient } from '../config/database';
import { Prisma } from '@prisma/client';
import { Logger } from '../utils/logger';
import { ROLES } from '../auth/roles';
import { AppError } from '../utils/errors';

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
    limit?: number;
    offset?: number;
  } = {}) {
    const prisma = getPrismaClient();
    const { userId, entityType, action, limit = 50, offset = 0 } = filters;

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

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

    return { logs, total };
  }

  /**
   * Create admin notification
   */
  static async createNotification(data: {
    userId?: string;
    type: string;
    title: string;
    message: string;
    metadata?: any;
    priority?: string;
  }) {
    return getPrismaClient().adminNotification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata as Prisma.InputJsonValue,
        priority: data.priority || 'INFO',
      },
    });
  }

  /**
   * Get notifications for admin users
   */
  static async getNotifications(userId?: string, unreadOnly = false) {
    const prisma = getPrismaClient();
    const where: Prisma.AdminNotificationWhereInput = {};
    
    if (userId) where.userId = userId;
    if (unreadOnly) where.isRead = false;

    return prisma.adminNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Mark a notification as read. Scoped to the owning admin so any admin can
   * never mark another admin's notification (no cross-administrator writes).
   * Returns null when the notification is not found / not owned.
   */
  static async markNotificationRead(notificationId: string, userId?: string) {
    const filter: Prisma.AdminNotificationWhereInput = { id: notificationId };
    if (userId) filter.userId = userId;
    const result = await getPrismaClient().adminNotification.updateMany({
      where: filter,
      data: { isRead: true, readAt: new Date() },
    });
    if (result.count === 0) return null;
    return getPrismaClient().adminNotification.findUnique({ where: { id: notificationId } });
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
   * Get dashboard statistics
   */
  static async getDashboardStats() {
    const prisma = getPrismaClient();

    const [
      totalOrders,
      pendingOrders,
      inProductionOrders,
      completedOrders,
      totalUsers,
      totalQuotes,
      totalCadFiles,
      totalManufacturers,
      activeManufacturers,
      pendingManufacturingRequests,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'In Review' } }),
      prisma.order.count({ where: { status: 'In Production' } }),
      prisma.order.count({ where: { status: 'Delivered' } }),
      prisma.user.count(),
      prisma.quote.count(),
      prisma.cadFile.count(),
      prisma.manufacturer.count(),
      prisma.manufacturer.count({ where: { status: 'ACTIVE' } }),
      prisma.manufacturingRequest.count({ where: { status: 'PENDING' } }),
    ]);

    // Calculate revenue (from orders)
    const orders = await prisma.order.findMany({
      where: { status: { in: ['Delivered', 'In Production'] } },
      select: { totalCost: true },
    });

    const totalRevenue = orders.reduce((sum, order) => {
      const cost = parseFloat(order.totalCost.replace(/[^0-9.-]+/g, '')) || 0;
      return sum + cost;
    }, 0);

    return {
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        inProduction: inProductionOrders,
        completed: completedOrders,
      },
      users: {
        total: totalUsers,
      },
      quotes: {
        total: totalQuotes,
      },
      cadFiles: {
        total: totalCadFiles,
      },
      manufacturers: {
        total: totalManufacturers,
        active: activeManufacturers,
      },
      manufacturingRequests: {
        pending: pendingManufacturingRequests,
      },
      revenue: {
        total: totalRevenue,
        currency: 'EGP',
      },
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