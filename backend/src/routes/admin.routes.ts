import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiResponseHelper } from '../utils/response';
import { AdminService, parseOrderCost, cairoDayKey, cairoDayToUtc, cairoOffsetMs } from '../services/admin.service';
import { NotificationEvents } from '../services/notification-events.service';
import { OrdersService } from '../services/orders.service';
import { getPrismaClient } from '../config/database';
import { requireAnyAdmin, requireSuperAdmin, requireOperationsAdmin, requirePricingAdmin, requireSupportAdmin, requireFinanceAdmin } from '../middleware/admin.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { AppError, sendSafeRouteError } from '../utils/errors';
import { AdminAuthService } from '../services/admin-auth.service';
import { isRole } from '../auth/roles';

const router = Router();

/**
 * Format a numeric price consistently with existing Order.totalCost values
 * (e.g. "7,284.51 EGP"). Extracts the currency code already stored on the
 * order, or falls back to the platform default. The database is authoritative
 * for the stored value — this only renders the final currency suffix.
 */
const formatOrderPrice = (amount: number, previousValue?: string | null): string => {
  const currency = previousValue?.match(/[A-Z]{3}|EGP|\$|€/)?.[0] || 'EGP';
  const localized = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  if (currency === '$') return `$${localized}`;
  if (currency === '€') return `€${localized}`;
  return `${localized} ${currency}`;
};

// ============================================================================
// DASHBOARD
// ============================================================================

router.get('/dashboard', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const { range } = req.query;
    const stats = await AdminService.getDashboardStats(typeof range === 'string' ? range : undefined);
    ApiResponseHelper.success(res, stats, 'Dashboard statistics retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'DASHBOARD_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// ============================================================================
// ADMIN USERS
// ============================================================================

router.get('/users', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const adminUsers = await AdminService.getAdminUsers();
    ApiResponseHelper.success(res, adminUsers, 'Admin users retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'ADMIN_USERS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.post('/users', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(120),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.string(),
      company: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    if (!isRole(data.role)) {
      ApiResponseHelper.error(res, 'INVALID_ROLE', 'role must be a valid CAM LABS role.', 400);
      return;
    }
    const passwordCheck = AdminAuthService.validateAdminPassword(data.password);
    if (!passwordCheck.valid) {
      ApiResponseHelper.error(res, 'WEAK_PASSWORD', passwordCheck.error || 'Weak password', 400);
      return;
    }
    const user = await AdminService.createAdminUser(data);
    
    // Remove password hash from response
    const { passwordHash, ...safeUser } = user as any;
    ApiResponseHelper.success(res, safeUser, 'Admin user created', 201);
  } catch (error: any) {
    if (error instanceof AppError) {
      ApiResponseHelper.error(res, error.code, error.message, error.statusCode);
      return;
    }
    ApiResponseHelper.error(res, 'CREATE_ADMIN_ERROR', 'Admin user could not be created.', 400);
  }
});

router.put('/users/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(120).optional(),
      role: z.string().optional(),
      accountStatus: z.string().optional(),
      adminNotes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    if (data.role !== undefined && !isRole(data.role)) {
      ApiResponseHelper.error(res, 'INVALID_ROLE', 'role must be a valid CAM LABS role.', 400);
      return;
    }
    if (data.accountStatus !== undefined && !['ACTIVE', 'DISABLED', 'SUSPENDED'].includes(data.accountStatus)) {
      ApiResponseHelper.error(res, 'INVALID_ACCOUNT_STATUS', 'accountStatus must be ACTIVE, DISABLED or SUSPENDED.', 400);
      return;
    }
    const user = await AdminService.updateAdminUser(req.params.id, data);
    
    const { passwordHash, ...safeUser } = user as any;
    ApiResponseHelper.success(res, safeUser, 'Admin user updated');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'UPDATE_ADMIN_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

router.post('/users/:id/reset-password', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      newPassword: z.string().min(8),
    });

    const { newPassword } = schema.parse(req.body);
    const passwordCheck = AdminAuthService.validateAdminPassword(newPassword);
    if (!passwordCheck.valid) {
      ApiResponseHelper.error(res, 'WEAK_PASSWORD', passwordCheck.error || 'Weak password', 400);
      return;
    }
    const user = await AdminService.resetAdminPassword(req.params.id, newPassword);
    
    const { passwordHash, ...safeUser } = user as any;
    ApiResponseHelper.success(res, safeUser, 'Password reset successfully');
  } catch (error: any) {
    if (error instanceof AppError) {
      ApiResponseHelper.error(res, error.code, error.message, error.statusCode);
      return;
    }
    ApiResponseHelper.error(res, 'PASSWORD_RESET_ERROR', 'Password reset failed.', 400);
  }
});

// ============================================================================
// ORDERS MANAGEMENT
// ============================================================================

/** Order row projection shared by the list view (customer + manufacturer + CAD files). */
const ORDER_ROW_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
    },
  },
  manufacturer: true,
  cadFiles: {
    include: {
      cadFile: true,
    },
  },
} satisfies Prisma.OrderInclude;

/** Build the shared Prisma `where` clause for order listing / filtering / export. */
const buildOrderListWhere = (query: Record<string, unknown>): Prisma.OrderWhereInput => {
  const { search, status, technology, material, manufacturerId, startDate, endDate } = query;
  const where: Prisma.OrderWhereInput = {};
  if (typeof status === 'string' && status) where.status = status;
  if (typeof technology === 'string' && technology) where.technology = technology;
  if (typeof material === 'string' && material) where.material = material;
  if (typeof manufacturerId === 'string' && manufacturerId) where.manufacturerId = manufacturerId;

  if (typeof search === 'string') {
    const q = search.trim();
    if (q) {
      const match = { contains: q, mode: 'insensitive' as const };
      where.OR = [
        { id: match },
        { partName: match },
        { technology: match },
        { material: match },
        { user: { name: match } },
        { user: { email: match } },
        { user: { company: match } },
        { manufacturer: { companyName: match } },
      ];
    }
  }

  if ((typeof startDate === 'string' && startDate) || (typeof endDate === 'string' && endDate)) {
    const window: Prisma.DateTimeFilter<'Order'> = {};
    if (typeof startDate === 'string' && startDate) window.gte = cairoDayToUtc(startDate);
    if (typeof endDate === 'string' && endDate) {
      window.lte = new Date(cairoDayToUtc(endDate).getTime() + 86_400_000 - 1);
    }
    where.createdAt = window;
  }

  return where;
};

/** Map a safe admin sort column to a Prisma orderBy clause (Total is handled separately). */
const orderSortFor = (sortBy: unknown, sortDir: unknown): Prisma.OrderOrderByWithRelationInput => {
  const dir = sortDir === 'asc' ? 'asc' : 'desc';
  switch (sortBy) {
    case 'id': return { id: dir };
    case 'quantity': return { quantity: dir };
    case 'status': return { status: dir };
    case 'partName': return { partName: dir };
    case 'technology': return { technology: dir };
    case 'material': return { material: dir };
    case 'customer': return { user: { name: dir } };
    case 'manufacturer': return { manufacturer: { companyName: dir } };
    default: return { createdAt: dir };
  }
};

/** Real order-activity trend grouped into Cairo-calendar day buckets (last 30 days). */
const buildOrderTrend = (rows: Array<{ status: string; createdAt: Date }>): Array<{
  date: string;
  orders: number;
  inReview: number;
  inProduction: number;
  completed: number;
  cancelled: number;
}> => {
  const cairoTodayKey = cairoDayKey(new Date());
  const startKey = cairoDayKey(new Date(Date.now() + cairoOffsetMs - 29 * 86_400_000));
  const cursor = cairoDayToUtc(startKey);
  const endAt = cairoDayToUtc(cairoTodayKey);
  const keys: string[] = [];
  while (cursor.getTime() <= endAt.getTime()) {
    keys.push(cairoDayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const zero = { orders: 0, inReview: 0, inProduction: 0, completed: 0, cancelled: 0 };
  const byDay = new Map<string, typeof zero>();
  for (const row of rows) {
    const key = cairoDayKey(row.createdAt);
    const entry = byDay.get(key) ?? { ...zero };
    entry.orders += 1;
    if (row.status === 'In Review') entry.inReview += 1;
    else if (row.status === 'In Production') entry.inProduction += 1;
    else if (row.status === 'Delivered') entry.completed += 1;
    else if (row.status === 'Cancelled') entry.cancelled += 1;
    byDay.set(key, entry);
  }

  return keys.map((date) => ({ date, ...(byDay.get(date) ?? { ...zero }) }));
};

router.get('/orders', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const sortBy = req.query.sortBy;
    const sortDir = req.query.sortDir;
    const where = buildOrderListWhere(req.query as Record<string, unknown>);

    // KPI counts, sparkline trend and filter facets — global source of truth,
    // computed independently of the current page filters.
    const startKey = cairoDayKey(new Date(Date.now() + cairoOffsetMs - 29 * 86_400_000));
    const [byStatus, totalOrders, windowRows, technologies, materials] = await Promise.all([
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.order.count(),
      prisma.order.findMany({
        where: { createdAt: { gte: cairoDayToUtc(startKey) } },
        select: { status: true, createdAt: true },
      }),
      prisma.order.findMany({ select: { technology: true }, distinct: ['technology'] }),
      prisma.order.findMany({ select: { material: true }, distinct: ['material'] }),
    ]);

    const countByStatus: Record<string, number> = {};
    for (const row of byStatus) countByStatus[row.status] = row._count._all;

    const stats = {
      totalOrders,
      inReview: countByStatus['In Review'] ?? 0,
      inProduction: countByStatus['In Production'] ?? 0,
      qualityInspection: countByStatus['Quality Inspection'] ?? 0,
      completed: countByStatus['Delivered'] ?? 0,
      cancelled: countByStatus['Cancelled'] ?? 0,
      trend: buildOrderTrend(windowRows),
    };

    const filters = {
      technologies: technologies.map((t) => t.technology).filter(Boolean),
      materials: materials.map((m) => m.material).filter(Boolean),
    };

    let orders: unknown[];
    let total: number;

    if (sortBy === 'total') {
      // totalCost is a formatted money string — sort numerically by parsing it.
      const allRows = await prisma.order.findMany({ where, select: { id: true, totalCost: true } });
      allRows.sort((a, b) => {
        const diff = parseOrderCost(a.totalCost) - parseOrderCost(b.totalCost);
        return sortDir === 'asc' ? diff : -diff;
      });
      total = allRows.length;
      const pageIds = allRows.slice(offset, offset + limit).map((row) => row.id);
      const idRank = new Map(pageIds.map((id, index) => [id, index]));
      const fetched = await prisma.order.findMany({ where: { id: { in: pageIds } }, include: ORDER_ROW_INCLUDE });
      orders = fetched.sort((a, b) => (idRank.get(a.id) ?? 0) - (idRank.get(b.id) ?? 0));
    } else {
      [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: ORDER_ROW_INCLUDE,
          orderBy: orderSortFor(sortBy, sortDir),
          take: limit,
          skip: offset,
        }),
        prisma.order.count({ where }),
      ]);
    }

    ApiResponseHelper.success(res, { orders, total, stats, filters }, 'Orders retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'ORDERS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// GET /orders/export — CSV download of the currently filtered order dataset.
router.get('/orders/export', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const orders = await prisma.order.findMany({
      where: buildOrderListWhere(req.query as Record<string, unknown>),
      include: {
        user: { select: { id: true, name: true, email: true, company: true } },
        manufacturer: { select: { id: true, companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const esc = (value: unknown): string => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = ['Order ID', 'Customer', 'Email', 'Company', 'Part Name', 'Technology', 'Material', 'Qty', 'Total', 'Status', 'Manufacturer', 'Date'];
    const rows = orders.map((order) =>
      [
        order.id,
        order.user?.name,
        order.user?.email,
        order.user?.company,
        order.partName,
        order.technology,
        order.material,
        order.quantity,
        order.totalCost,
        order.status,
        order.manufacturer?.companyName,
        order.date || cairoDayKey(order.createdAt),
      ]
        .map(esc)
        .join(','),
    );
    const csv = [header.join(','), ...rows].join('\n');

    const fileName = `cam-labs-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'ORDERS_EXPORT_ERROR', message: 'Order export could not be completed.', status: 500 });
  }
});

// POST /orders/from-quote/:quoteId — create an order from an approved quote
// (reuses the existing quote-to-order conversion business logic for staff).
router.post('/orders/from-quote/:quoteId', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const order = await OrdersService.convertQuoteToOrder(req.params.quoteId);
    ApiResponseHelper.success(res, order, 'Quote converted to manufacturing order', 201);
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'QUOTE_CONVERSION_ERROR', message: 'Quote could not be converted to an order.' });
  }
});

router.get('/orders/:id', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            address: true,
          },
        },
        manufacturer: true,
        cadFiles: {
          include: {
            cadFile: {
              include: {
                versions: {
                  orderBy: { version: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        pricingEquationVersion: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
        manufacturingRequests: {
          include: {
            manufacturer: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      ApiResponseHelper.error(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
      return;
    }

    ApiResponseHelper.success(res, order, 'Order details retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'ORDER_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.put('/orders/:id/status', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const ORDER_LIFECYCLE_STATUSES = ['In Review', 'In Production', 'Quality Inspection', 'Delivered', 'Cancelled'];
    const MANUFACTURING_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'QUALITY', 'COMPLETED', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELLED'];
    const SHIPPING_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'];

    const schema = z.object({
      status: z.string(),
      manufacturingStatus: z.string().optional(),
      shippingStatus: z.string().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    if (!ORDER_LIFECYCLE_STATUSES.includes(data.status)) {
      throw new AppError(`status must be one of: ${ORDER_LIFECYCLE_STATUSES.join(', ')}.`, 400, 'INVALID_ORDER_STATUS');
    }
    if (data.manufacturingStatus && !MANUFACTURING_STATUSES.includes(data.manufacturingStatus)) {
      throw new AppError('Manufacturing status is not a valid CAM LABS status.', 400, 'INVALID_MANUFACTURING_STATUS');
    }
    if (data.shippingStatus && !SHIPPING_STATUSES.includes(data.shippingStatus)) {
      throw new AppError('Shipping status is not a valid shipping status.', 400, 'INVALID_SHIPPING_STATUS');
    }

    const prisma = getPrismaClient();

    const existingOrder = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!existingOrder) {
      ApiResponseHelper.error(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: data.status,
        manufacturingStatus: data.manufacturingStatus,
        shippingStatus: data.shippingStatus,
      },
    });

    // Create order event
    await prisma.orderEvent.create({
      data: {
        orderId: req.params.id,
        eventType: 'STATUS_UPDATE',
        description: `Order status updated to ${data.status}`,
        metadata: data as any,
      },
    });

    // Create audit log
    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'UPDATE',
      entityType: 'ORDER',
      entityId: req.params.id,
      oldValue: { 
        status: existingOrder.status, 
        manufacturingStatus: existingOrder.manufacturingStatus,
        shippingStatus: existingOrder.shippingStatus,
      },
      newValue: { 
        status: data.status, 
        manufacturingStatus: data.manufacturingStatus,
        shippingStatus: data.shippingStatus,
      },
    });

    ApiResponseHelper.success(res, updatedOrder, 'Order status updated');
  } catch (error: any) {
    if (error instanceof AppError) {
      ApiResponseHelper.error(res, error.code, error.message, error.statusCode);
      return;
    }
    ApiResponseHelper.error(res, 'ORDER_STATUS_ERROR', 'Order status could not be updated.', 400);
  }
});

// ============================================================================
// SUPER ADMIN — ORDER MANAGEMENT ACTIONS
// ============================================================================

/**
 * POST /admin/orders/:id/approve
 * Review and approve a customer's submitted order. Moves the order from a
 * review state into production and records the action in the order event
 * stream and the global audit log. Authorized only for operations-level
 * admins (super admin / admin / operations admin).
 */
router.post('/orders/:id/approve', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      notes: z.string().optional(),
    });
    const { notes } = schema.parse(req.body || {});
    const prisma = getPrismaClient();

    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      ApiResponseHelper.error(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
      return;
    }
    if (existing.status === 'Cancelled') {
      throw new AppError('A cancelled order cannot be approved.', 400, 'ORDER_CANCELLED');
    }
    if (['Delivered', 'Quality Inspection'].includes(existing.status)) {
      throw new AppError(`Order is already ${existing.status.toLowerCase()} and cannot be approved again.`, 400, 'ORDER_ALREADY_APPROVED');
    }

    const approvedStatus = 'In Production';
    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: approvedStatus, statusBadge: 'badge-blue' },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: req.params.id,
        eventType: 'ORDER_APPROVED',
        description: notes ? `Order approved for production. ${notes}` : 'Order approved for production.',
        metadata: { approvedBy: req.auth?.id, from: existing.status, to: approvedStatus, notes },
      },
    });

    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'APPROVE',
      entityType: 'ORDER',
      entityId: req.params.id,
      oldValue: { status: existing.status },
      newValue: { status: approvedStatus },
      metadata: { notes },
    });

    ApiResponseHelper.success(res, updatedOrder, 'Order approved and moved into production');
  } catch (error: any) {
    if (error instanceof AppError) {
      ApiResponseHelper.error(res, error.code, error.message, error.statusCode);
      return;
    }
    ApiResponseHelper.error(res, 'ORDER_APPROVE_ERROR', 'Order could not be approved.', 400);
  }
});

/**
 * PUT /admin/orders/:id/price
 * Modify the authoritative order price. The backend validates the new value,
 * persists it on the real database record, and records who changed it, when,
 * the previous price and the new price in the order event stream and audit log.
 */
router.put('/orders/:id/price', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      price: z.number().positive('price must be a positive number'),
      reason: z.string().optional(),
    });
    const { price, reason } = schema.parse(req.body);
    const prisma = getPrismaClient();

    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      ApiResponseHelper.error(res, 'ORDER_NOT_FOUND', 'Order not found', 404);
      return;
    }
    const previousPrice = existing.totalCost;
    const nextPrice = formatOrderPrice(price, existing.totalCost);

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: { totalCost: nextPrice },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: req.params.id,
        eventType: 'PRICE_UPDATED',
        description: `Order price updated from ${previousPrice} to ${nextPrice}.`,
        metadata: { previousPrice, newPrice: nextPrice, price, changedBy: req.auth?.id, changedByName: req.auth?.name, reason },
      },
    });

    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'UPDATE',
      entityType: 'ORDER',
      entityId: req.params.id,
      oldValue: { totalCost: previousPrice },
      newValue: { totalCost: nextPrice },
      metadata: { reason },
    });

    ApiResponseHelper.success(res, updatedOrder, 'Order price updated');
  } catch (error: any) {
    if (error instanceof AppError) {
      ApiResponseHelper.error(res, error.code, error.message, error.statusCode);
      return;
    }
    ApiResponseHelper.error(res, 'ORDER_PRICE_ERROR', 'Order price could not be updated.', 400);
  }
});

// ============================================================================
// MANUFACTURERS
// ============================================================================

router.get('/manufacturers', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, availability, search, limit = 100, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status as string;
    if (availability) where.availability = availability as string;
    if (search) {
      const q = String(search);
      where.OR = [
        { companyName: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [manufacturers, total, byStatus, byAvailability] = await Promise.all([
      prisma.manufacturer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.manufacturer.count({ where }),
      prisma.manufacturer.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.manufacturer.groupBy({
        by: ['availability'],
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
    }
    const availabilityCounts: Record<string, number> = {};
    for (const row of byAvailability) {
      availabilityCounts[row.availability] = row._count._all;
    }

    const stats = {
      totalManufacturers: total,
      active: statusCounts.ACTIVE ?? 0,
      inactive: statusCounts.INACTIVE ?? 0,
      suspended: statusCounts.SUSPENDED ?? 0,
      available: availabilityCounts.AVAILABLE ?? 0,
      busy: availabilityCounts.BUSY ?? 0,
      offline: availabilityCounts.OFFLINE ?? 0,
    };

    ApiResponseHelper.success(res, { manufacturers, total, stats }, 'Manufacturers retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'MANUFACTURERS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.post('/manufacturers', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      companyName: z.string().min(2),
      contactPerson: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      location: z.string().optional(),
      address: z.string().optional(),
      supportedTechnologies: z.array(z.string()),
      supportedMaterials: z.array(z.string()),
      capacity: z.number().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const manufacturer = await getPrismaClient().manufacturer.create({
      data,
    });

    // Create audit log
    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'CREATE',
      entityType: 'MANUFACTURER',
      entityId: manufacturer.id,
      newValue: data,
    });

    ApiResponseHelper.success(res, manufacturer, 'Manufacturer created', 201);
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'CREATE_MANUFACTURER_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

router.put('/manufacturers/:id', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      companyName: z.string().min(2).optional(),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      address: z.string().optional(),
      supportedTechnologies: z.array(z.string()).optional(),
      supportedMaterials: z.array(z.string()).optional(),
      capacity: z.number().optional(),
      availability: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const prisma = getPrismaClient();

    const existing = await prisma.manufacturer.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      ApiResponseHelper.error(res, 'MANUFACTURER_NOT_FOUND', 'Manufacturer not found', 404);
      return;
    }

    const updated = await prisma.manufacturer.update({
      where: { id: req.params.id },
      data,
    });

    // Create audit log
    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'UPDATE',
      entityType: 'MANUFACTURER',
      entityId: req.params.id,
      oldValue: existing,
      newValue: updated,
    });

    ApiResponseHelper.success(res, updated, 'Manufacturer updated');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'UPDATE_MANUFACTURER_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

router.get('/manufacturers/:id', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const manufacturer = await prisma.manufacturer.findUnique({
      where: { id: req.params.id },
      include: {
        orders: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            pricingEquationVersion: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        manufacturingRequests: {
          include: {
            order: { select: { id: true, partName: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!manufacturer) {
      ApiResponseHelper.error(res, 'MANUFACTURER_NOT_FOUND', 'Manufacturer not found', 404);
      return;
    }

    ApiResponseHelper.success(res, manufacturer, 'Manufacturer details retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'MANUFACTURER_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// ============================================================================
// MANUFACTURER ASSIGNMENT
// ============================================================================

router.post('/orders/:id/assign-manufacturer', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      manufacturerId: z.string(),
      notes: z.string().optional(),
    });

    const { manufacturerId, notes } = schema.parse(req.body);
    const prisma = getPrismaClient();

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { manufacturerId },
      include: { manufacturer: true },
    });

    // Create manufacturing request
    await prisma.manufacturingRequest.create({
      data: {
        orderId: req.params.id,
        manufacturerId,
        technology: order.technology,
        material: order.material,
        quantity: order.quantity,
        status: 'PENDING',
        notes,
      },
    });

    // Create order event
    await prisma.orderEvent.create({
      data: {
        orderId: req.params.id,
        eventType: 'MANUFACTURER_ASSIGNED',
        description: `Order assigned to manufacturer`,
        metadata: { manufacturerId, notes },
      },
    });

    // Create audit log
    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'ASSIGN',
      entityType: 'ORDER',
      entityId: req.params.id,
      newValue: { manufacturerId },
    });

    ApiResponseHelper.success(res, order, 'Manufacturer assigned successfully');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'ASSIGNMENT_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

// ============================================================================
// MANUFACTURING REQUESTS
// ============================================================================

router.get('/manufacturing-requests', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, manufacturerId, search, limit = 100, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status as string;
    if (manufacturerId) where.manufacturerId = manufacturerId as string;
    if (search) {
      const q = String(search);
      where.OR = [
        { order: { id: { contains: q, mode: 'insensitive' } } },
        { order: { partName: { contains: q, mode: 'insensitive' } } },
        { technology: { contains: q, mode: 'insensitive' } },
        { material: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [requests, total, byStatus] = await Promise.all([
      prisma.manufacturingRequest.findMany({
        where,
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          manufacturer: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.manufacturingRequest.count({ where }),
      prisma.manufacturingRequest.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
    }

    const stats = {
      totalRequests: total,
      pending: statusCounts.PENDING ?? 0,
      accepted: statusCounts.ACCEPTED ?? 0,
      rejected: statusCounts.REJECTED ?? 0,
      inProgress: statusCounts.IN_PROGRESS ?? 0,
      completed: statusCounts.COMPLETED ?? 0,
      cancelled: statusCounts.CANCELLED ?? 0,
    };

    ApiResponseHelper.success(res, { requests, total, stats }, 'Manufacturing requests retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'MANUFACTURING_REQUESTS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.put('/manufacturing-requests/:id/status', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      status: z.string(),
      notes: z.string().optional(),
      estimatedCompletion: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const MANUFACTURING_REQUEST_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'QUALITY', 'COMPLETED', 'REJECTED', 'CANCELLED'];
    if (!MANUFACTURING_REQUEST_STATUSES.includes(data.status)) {
      throw new AppError(`status must be one of: ${MANUFACTURING_REQUEST_STATUSES.join(', ')}.`, 400, 'INVALID_REQUEST_STATUS');
    }
    const prisma = getPrismaClient();

    const existing = await prisma.manufacturingRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      ApiResponseHelper.error(res, 'REQUEST_NOT_FOUND', 'Manufacturing request not found', 404);
      return;
    }

    const updateData: any = {
      status: data.status,
      notes: data.notes,
    };

    if (data.status === 'ACCEPTED') {
      updateData.acceptedAt = new Date();
    } else if (data.status === 'IN_PROGRESS') {
      updateData.startedAt = new Date();
    } else if (data.status === 'COMPLETED') {
      updateData.completedAt = new Date();
      updateData.actualCompletion = new Date().toISOString().split('T')[0];
    }

    const updated = await prisma.manufacturingRequest.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Create audit log
    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'UPDATE',
      entityType: 'MANUFACTURING_REQUEST',
      entityId: req.params.id,
      oldValue: { status: existing.status },
      newValue: { status: data.status },
    });

    ApiResponseHelper.success(res, updated, 'Manufacturing request status updated');
  } catch (error: any) {
    if (error instanceof AppError) {
      ApiResponseHelper.error(res, error.code, error.message, error.statusCode);
      return;
    }
    ApiResponseHelper.error(res, 'REQUEST_STATUS_ERROR', 'Manufacturing request status could not be updated.', 400);
  }
});

router.get('/manufacturing-requests/:id', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const request = await prisma.manufacturingRequest.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            manufacturer: true,
            pricingEquationVersion: true,
            cadFiles: { include: { cadFile: true } },
          },
        },
        manufacturer: true,
      },
    });

    if (!request) {
      ApiResponseHelper.error(res, 'REQUEST_NOT_FOUND', 'Manufacturing request not found', 404);
      return;
    }

    ApiResponseHelper.success(res, request, 'Manufacturing request details retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'REQUEST_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// ============================================================================
// CUSTOMERS
// ============================================================================

router.get('/customers', requireSupportAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, search, limit = 100, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.accountStatus = status as string;
    if (search) {
      const q = String(search);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
      ];
    }

    const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [customers, total, byStatus, newRecent, withOrders] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          _count: {
            select: {
              orders: true,
              quotes: true,
              cadFiles: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.user.count({ where }),
      prisma.user.groupBy({
        by: ['accountStatus'],
        _count: { _all: true },
      }),
      prisma.user.count({
        where: {
          role: 'CUSTOMER',
          createdAt: { gte: recent },
        },
      }),
      prisma.user.count({
        where: {
          orders: { some: {} },
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.accountStatus] = row._count._all;
    }

    const stats = {
      totalCustomers: total,
      active: statusCounts.ACTIVE ?? 0,
      disabled: statusCounts.DISABLED ?? 0,
      suspended: statusCounts.SUSPENDED ?? 0,
      newRecent,
      withOrders,
    };

    // Credentials must never leave the server — not even to admin dashboards.
    const safeCustomers = customers.map(({ passwordHash: _passwordHash, ...safeCustomer }) => safeCustomer);
    ApiResponseHelper.success(res, { customers: safeCustomers, total, stats }, 'Customers retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'CUSTOMERS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.get('/customers/:id', requireSupportAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const customer = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        orders: {
          include: {
            manufacturer: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        cadFiles: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!customer) {
      ApiResponseHelper.error(res, 'CUSTOMER_NOT_FOUND', 'Customer not found', 404);
      return;
    }

    const { passwordHash, ...safeCustomer } = customer as any;
    ApiResponseHelper.success(res, safeCustomer, 'Customer details retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'CUSTOMER_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// ============================================================================
// QUOTES
// ============================================================================

router.get('/quotes', requireSupportAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, search, limit = 100, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status as string;
    if (search) {
      const q = String(search);
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { partName: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [quotes, total, byStatus, converted] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
            },
          },
          pricingEquationVersion: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.quote.count({ where }),
      prisma.quote.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.quote.count({
        where: {
          convertedOrderId: { not: null },
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
    }

    const stats = {
      totalQuotes: total,
      approved: statusCounts.Approved ?? 0,
      pending: statusCounts['Ready for Approval'] ?? 0,
      revised: statusCounts.Revised ?? 0,
      rejected: statusCounts.Rejected ?? 0,
      draft: statusCounts.Draft ?? 0,
      converted,
    };

    ApiResponseHelper.success(res, { quotes, total, stats }, 'Quotes retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'QUOTES_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.get('/quotes/:id', requireSupportAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            accountStatus: true,
            createdAt: true,
          },
        },
        pricingEquationVersion: true,
      },
    });

    if (!quote) {
      ApiResponseHelper.error(res, 'QUOTE_NOT_FOUND', 'Quote not found', 404);
      return;
    }

    ApiResponseHelper.success(res, quote, 'Quote details retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'QUOTE_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// ============================================================================
// CAD FILES
// ============================================================================

router.get('/cad-files', requireSupportAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, search, limit = 100, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status as string;
    if (search) {
      const q = String(search);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { format: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [cadFiles, total, byStatus] = await Promise.all([
      prisma.cadFile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.cadFile.count({ where }),
      prisma.cadFile.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
    }

    const stats = {
      totalFiles: total,
      verified: statusCounts['Verified CAD'] ?? 0,
      analyzing: statusCounts.Analyzing ?? 0,
      flagged: statusCounts['DFM Flagged'] ?? 0,
      quarantined: statusCounts.Quarantined ?? 0,
      failed: statusCounts['Processing Failed'] ?? 0,
    };

    ApiResponseHelper.success(res, { cadFiles, total, stats }, 'CAD files retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'CAD_FILES_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.get('/cad-files/:id', requireSupportAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const cadFile = await prisma.cadFile.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        versions: { orderBy: { version: 'desc' } },
        orders: {
          include: {
            order: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                manufacturer: true,
              },
            },
          },
        },
      },
    });

    if (!cadFile) {
      ApiResponseHelper.error(res, 'CAD_FILE_NOT_FOUND', 'CAD file not found', 404);
      return;
    }

    ApiResponseHelper.success(res, cadFile, 'CAD file details retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'CAD_FILE_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// ============================================================================
// MATERIALS
// ============================================================================

router.get('/materials', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { technology, category, isActive, search, limit = 100, offset = 0 } = req.query;

    const where: any = {};
    if (technology) where.technology = technology as string;
    if (category) where.category = category as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      const q = String(search);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { technology: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [materials, total, byAvailability, activeCount] = await Promise.all([
      prisma.material.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.material.count({ where }),
      prisma.material.groupBy({
        by: ['availability'],
        _count: { _all: true },
      }),
      prisma.material.count({
        where: {
          isActive: true,
        },
      }),
    ]);

    const availabilityCounts: Record<string, number> = {};
    for (const row of byAvailability) {
      availabilityCounts[row.availability] = row._count._all;
    }

    const stats = {
      totalMaterials: total,
      active: activeCount,
      inStock: availabilityCounts.IN_STOCK ?? 0,
      outOfStock: availabilityCounts.OUT_OF_STOCK ?? 0,
    };

    ApiResponseHelper.success(res, { materials, total, stats }, 'Materials retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'MATERIALS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.post('/materials', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, 'id must be a lowercase slug (2-64 chars, a-z0-9 and dashes).'),
      name: z.string().min(2),
      technology: z.string(),
      category: z.string(),
      description: z.string(),
      tensileStrength: z.number(),
      hdt: z.number(),
      elongation: z.number(),
      density: z.number().positive(),
      standardTolerance: z.string(),
      minWallThickness: z.string(),
      leadTime: z.string(),
      surfaceFinish: z.string(),
      tags: z.array(z.string()),
      colorOptions: z.array(z.string()),
      idealFor: z.string(),
      pricePerUnit: z.number().nonnegative().optional(),
      priceUnit: z.string().optional(),
      availability: z.string().optional(),
    });

    const data = schema.parse(req.body);
    if (data.priceUnit && !['EGP', 'EGP/g', 'EGP/cm³', 'USD'].includes(data.priceUnit)) {
      ApiResponseHelper.error(res, 'INVALID_PRICE_UNIT', 'priceUnit must be EGP, EGP/g, EGP/cm³ or USD.', 400);
      return;
    }
    if (data.availability && !['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER', 'DISCONTINUED'].includes(data.availability)) {
      ApiResponseHelper.error(res, 'INVALID_AVAILABILITY', 'availability is not a valid value.', 400);
      return;
    }
    const material = await getPrismaClient().material.create({
      data,
    });

    // Create audit log
    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'CREATE',
      entityType: 'MATERIAL',
      entityId: material.id,
      newValue: data,
    });

    ApiResponseHelper.success(res, material, 'Material created', 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      ApiResponseHelper.error(res, 'VALIDATION_ERROR', error.issues.map((issue: { message: string }) => issue.message).join('; '), 400);
      return;
    }
    if (error instanceof AppError) {
      ApiResponseHelper.error(res, error.code, error.message, error.statusCode);
      return;
    }
    ApiResponseHelper.error(res, 'CREATE_MATERIAL_ERROR', 'Material could not be created.', 400);
  }
});

router.put('/materials/:id', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      pricePerUnit: z.number().nonnegative().optional(),
      priceUnit: z.string().optional(),
      availability: z.string().optional(),
      isActive: z.boolean().optional(),
      archivedAt: z.any().optional(),
    });

    const data = schema.parse(req.body);
    if (data.priceUnit && !['EGP', 'EGP/g', 'EGP/cm³', 'USD'].includes(data.priceUnit)) {
      ApiResponseHelper.error(res, 'INVALID_PRICE_UNIT', 'priceUnit must be EGP, EGP/g, EGP/cm³ or USD.', 400);
      return;
    }
    if (data.availability && !['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER', 'DISCONTINUED'].includes(data.availability)) {
      ApiResponseHelper.error(res, 'INVALID_AVAILABILITY', 'availability is not a valid value.', 400);
      return;
    }
    const prisma = getPrismaClient();

    const existing = await prisma.material.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      ApiResponseHelper.error(res, 'MATERIAL_NOT_FOUND', 'Material not found', 404);
      return;
    }

    const updated = await prisma.material.update({
      where: { id: req.params.id },
      data,
    });

    // Create audit log
    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'UPDATE',
      entityType: 'MATERIAL',
      entityId: req.params.id,
      oldValue: { 
        pricePerUnit: existing.pricePerUnit, 
        availability: existing.availability,
        isActive: existing.isActive,
      },
      newValue: { 
        pricePerUnit: data.pricePerUnit, 
        availability: data.availability,
        isActive: data.isActive,
      },
    });

    ApiResponseHelper.success(res, updated, 'Material updated');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      ApiResponseHelper.error(res, 'VALIDATION_ERROR', error.issues.map((issue: { message: string }) => issue.message).join('; '), 400);
      return;
    }
    ApiResponseHelper.error(res, 'UPDATE_MATERIAL_ERROR', 'Material could not be updated.', 400);
  }
});

// ============================================================================
// PAYMENTS
// ============================================================================

router.get('/payments', requireFinanceAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, search, limit = 100, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.paymentStatus = status as string;
    if (search) {
      const q = String(search);
      where.OR = [
        { transactionId: { contains: q, mode: 'insensitive' } },
        { order: { id: { contains: q, mode: 'insensitive' } } },
        { order: { partName: { contains: q, mode: 'insensitive' } } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [payments, total, byStatus, revenue] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              partName: true,
              totalCost: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({
        by: ['paymentStatus'],
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: {
          paymentStatus: 'PAID',
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.paymentStatus] = row._count._all;
    }

    const stats = {
      totalPayments: total,
      totalRevenue: revenue._sum.amount ?? 0,
      paid: statusCounts.PAID ?? 0,
      pending: statusCounts.PENDING ?? 0,
      failed: statusCounts.FAILED ?? 0,
      refunded: statusCounts.REFUNDED ?? 0,
    };

    ApiResponseHelper.success(res, { payments, total, stats }, 'Payments retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'PAYMENTS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

router.get('/audit-logs', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, entityType, action, search, startDate, endDate, limit = 100, offset = 0 } = req.query;

    const { logs, total, stats } = await AdminService.getAuditLogs({
      userId: userId as string,
      entityType: entityType as string,
      action: action as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: Number(limit),
      offset: Number(offset),
    });

    ApiResponseHelper.success(res, { logs, total, stats }, 'Audit logs retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'AUDIT_LOGS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

router.get('/notifications', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const { unreadOnly, type, limit, offset } = req.query;
    const result = await AdminService.getNotifications(req.auth?.id, {
      unreadOnly: unreadOnly === 'true',
      type: typeof type === 'string' && type ? type : undefined,
      limit: typeof limit === 'string' && limit ? Number(limit) : undefined,
      offset: typeof offset === 'string' && offset ? Number(offset) : undefined,
    });
    ApiResponseHelper.success(res, result, 'Notifications retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'NOTIFICATIONS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.get('/notifications/unread-count', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const count = await AdminService.countUnreadNotifications(req.auth?.id);
    ApiResponseHelper.success(res, { count }, 'Unread notification count retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'NOTIFICATIONS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// Server-Sent Events stream for real-time admin notifications. The connection
// stays open and each new notification is pushed immediately (bell badge +
// dropdown update without polling or a page refresh).
router.get('/notifications/stream', requireAnyAdmin, async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`event: connected\ndata: {"ok":true}\n\n`);

  const unsubscribe = NotificationEvents.subscribe(res);
  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

router.put('/notifications/read-all', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const { count } = await AdminService.markAllNotificationsRead(req.auth!.id);
    ApiResponseHelper.success(res, { markedRead: count }, 'All notifications marked as read');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'NOTIFICATION_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

router.put('/notifications/:id/read', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const notification = await AdminService.markNotificationRead(req.params.id, req.auth?.id);
    if (!notification) {
      ApiResponseHelper.error(res, 'NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
      return;
    }
    ApiResponseHelper.success(res, notification, 'Notification marked as read');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'NOTIFICATION_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

export default router;