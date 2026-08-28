import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { requireAnyAdmin, requireFinanceAdmin, requireOperationsAdmin } from '../middleware/admin.middleware';
import { ApiResponseHelper } from '../utils/response';
import { AppError } from '../utils/errors';

const router = Router();

/**
 * Parse a query date param into a Date, rejecting malformed values so garbage
 * input can never produce an "Invalid Date" filter or a Prisma surprise.
 */
const parseDateParam = (value: unknown, label: string): Date | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${label} must be a valid date (ISO format).`, 400, 'INVALID_DATE');
  }
  return parsed;
};

// ============================================================================
// ORDERS REPORT
// ============================================================================
router.get('/orders', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { startDate, endDate, technology, manufacturerId, status } = req.query;

    const where: any = {};
    const start = parseDateParam(startDate, 'startDate'); if (start) where.createdAt = { ...where.createdAt, gte: start };
    const end = parseDateParam(endDate, 'endDate'); if (end) where.createdAt = { ...where.createdAt, lte: end };
    if (technology) where.technology = technology as string;
    if (manufacturerId) where.manufacturerId = manufacturerId as string;
    if (status) where.status = status as string;

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, company: true } },
        manufacturer: { select: { id: true, companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => {
      const cost = parseFloat(o.totalCost.replace(/[^0-9.-]+/g, '')) || 0;
      return sum + cost;
    }, 0);

    const statusBreakdown: Record<string, number> = {};
    const technologyBreakdown: Record<string, number> = {};
    for (const o of orders) {
      statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
      technologyBreakdown[o.technology] = (technologyBreakdown[o.technology] || 0) + 1;
    }

    ApiResponseHelper.success(res, {
      totalOrders,
      totalRevenue,
      currency: 'EGP',
      statusBreakdown,
      technologyBreakdown,
      orders,
    }, 'Orders report generated');
  } catch (error: any) {
    if (error instanceof AppError) { ApiResponseHelper.error(res, error.code, error.message, error.statusCode); return; } ApiResponseHelper.error(res, 'REPORT_ERROR', 'Report could not be generated.', 500);
  }
});

// ============================================================================
// REVENUE REPORT
// ============================================================================
router.get('/revenue', requireFinanceAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { startDate, endDate } = req.query;

    const where: any = {};
    const start = parseDateParam(startDate, 'startDate'); if (start) where.createdAt = { ...where.createdAt, gte: start };
    const end = parseDateParam(endDate, 'endDate'); if (end) where.createdAt = { ...where.createdAt, lte: end };

    const orders = await prisma.order.findMany({
      where: {
        ...where,
        status: { in: ['Delivered', 'In Production', 'Quality Inspection'] },
      },
      select: {
        totalCost: true,
        createdAt: true,
        status: true,
        technology: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = orders.reduce((sum, o) => {
      const cost = parseFloat(o.totalCost.replace(/[^0-9.-]+/g, '')) || 0;
      return sum + cost;
    }, 0);

    // Daily breakdown
    const dailyRevenue: Record<string, number> = {};
    for (const o of orders) {
      const day = o.createdAt.toISOString().split('T')[0];
      const cost = parseFloat(o.totalCost.replace(/[^0-9.-]+/g, '')) || 0;
      dailyRevenue[day] = (dailyRevenue[day] || 0) + cost;
    }

    // Technology breakdown
    const techRevenue: Record<string, number> = {};
    for (const o of orders) {
      const cost = parseFloat(o.totalCost.replace(/[^0-9.-]+/g, '')) || 0;
      techRevenue[o.technology] = (techRevenue[o.technology] || 0) + cost;
    }

    ApiResponseHelper.success(res, {
      totalRevenue,
      currency: 'EGP',
      orderCount: orders.length,
      dailyRevenue,
      techRevenue,
    }, 'Revenue report generated');
  } catch (error: any) {
    if (error instanceof AppError) { ApiResponseHelper.error(res, error.code, error.message, error.statusCode); return; } ApiResponseHelper.error(res, 'REVENUE_REPORT_ERROR', 'Report could not be generated.', 500);
  }
});

// ============================================================================
// MANUFACTURING REPORT
// ============================================================================
router.get('/manufacturing', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { startDate, endDate } = req.query;

    const where: any = {};
    const start = parseDateParam(startDate, 'startDate'); if (start) where.createdAt = { ...where.createdAt, gte: start };
    const end = parseDateParam(endDate, 'endDate'); if (end) where.createdAt = { ...where.createdAt, lte: end };

    const [manufacturers, requests, orders] = await Promise.all([
      prisma.manufacturer.findMany({
        select: {
          id: true,
          companyName: true,
          status: true,
          availability: true,
          currentOrders: true,
          completedOrders: true,
          performanceRating: true,
          supportedTechnologies: true,
        },
      }),
      prisma.manufacturingRequest.findMany({
        where,
        include: {
          manufacturer: { select: { id: true, companyName: true } },
          order: { select: { id: true, partName: true, technology: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.findMany({
        where: { ...where, manufacturerId: { not: null } },
        select: {
          id: true,
          technology: true,
          material: true,
          status: true,
          manufacturingStatus: true,
          manufacturerId: true,
        },
      }),
    ]);

    const statusBreakdown: Record<string, number> = {};
    for (const r of requests) {
      statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;
    }

    const techBreakdown: Record<string, number> = {};
    for (const o of orders) {
      techBreakdown[o.technology] = (techBreakdown[o.technology] || 0) + 1;
    }

    ApiResponseHelper.success(res, {
      manufacturers,
      totalManufacturers: manufacturers.length,
      activeManufacturers: manufacturers.filter(m => m.status === 'ACTIVE').length,
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status === 'PENDING').length,
      completedRequests: requests.filter(r => r.status === 'COMPLETED').length,
      statusBreakdown,
      techBreakdown,
      requests,
    }, 'Manufacturing report generated');
  } catch (error: any) {
    if (error instanceof AppError) { ApiResponseHelper.error(res, error.code, error.message, error.statusCode); return; } ApiResponseHelper.error(res, 'MFG_REPORT_ERROR', 'Report could not be generated.', 500);
  }
});

// ============================================================================
// CUSTOMER REPORT
// ============================================================================
router.get('/customers', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { startDate, endDate } = req.query;

    const where: any = {};
    const start = parseDateParam(startDate, 'startDate'); if (start) where.createdAt = { ...where.createdAt, gte: start };
    const end = parseDateParam(endDate, 'endDate'); if (end) where.createdAt = { ...where.createdAt, lte: end };

    const customers = await prisma.user.findMany({
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
    });

    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.accountStatus === 'ACTIVE').length;
    const totalOrders = customers.reduce((sum, c) => sum + c._count.orders, 0);
    // totalCost is a string field, calculate manually
    const spendingOrders = await prisma.order.findMany({
      where: { status: { in: ['Delivered', 'In Production'] } },
      select: { totalCost: true },
    });
    const totalSpendingValue = spendingOrders.reduce((sum, o) => {
      const cost = parseFloat(o.totalCost.replace(/[^0-9.-]+/g, '')) || 0;
      return sum + cost;
    }, 0);

    ApiResponseHelper.success(res, {
      totalCustomers,
      activeCustomers,
      totalOrders,
      totalSpending: totalSpendingValue.toFixed(2),
      currency: 'EGP',
      customers,
    }, 'Customer report generated');
  } catch (error: any) {
    if (error instanceof AppError) { ApiResponseHelper.error(res, error.code, error.message, error.statusCode); return; } ApiResponseHelper.error(res, 'CUSTOMER_REPORT_ERROR', 'Report could not be generated.', 500);
  }
});

// ============================================================================
// MATERIAL USAGE REPORT
// ============================================================================
router.get('/materials', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { startDate, endDate } = req.query;

    const where: any = {};
    const start = parseDateParam(startDate, 'startDate'); if (start) where.createdAt = { ...where.createdAt, gte: start };
    const end = parseDateParam(endDate, 'endDate'); if (end) where.createdAt = { ...where.createdAt, lte: end };

    const orders = await prisma.order.findMany({
      where,
      select: {
        material: true,
        technology: true,
        quantity: true,
        status: true,
      },
    });

    const materialUsage: Record<string, { count: number; totalQuantity: number; technologies: Set<string> }> = {};
    for (const o of orders) {
      if (!materialUsage[o.material]) {
        materialUsage[o.material] = { count: 0, totalQuantity: 0, technologies: new Set() };
      }
      materialUsage[o.material].count++;
      materialUsage[o.material].totalQuantity += o.quantity;
      materialUsage[o.material].technologies.add(o.technology);
    }

    const materials = await prisma.material.findMany({
      select: {
        id: true,
        name: true,
        technology: true,
        category: true,
        isActive: true,
        pricePerUnit: true,
        priceUnit: true,
      },
    });

    ApiResponseHelper.success(res, {
      materialUsage: Object.entries(materialUsage).map(([material, data]) => ({
        material,
        orderCount: data.count,
        totalQuantity: data.totalQuantity,
        technologies: Array.from(data.technologies),
      })),
      materials,
    }, 'Material usage report generated');
  } catch (error: any) {
    if (error instanceof AppError) { ApiResponseHelper.error(res, error.code, error.message, error.statusCode); return; } ApiResponseHelper.error(res, 'MATERIAL_REPORT_ERROR', 'Report could not be generated.', 500);
  }
});

// ============================================================================
// QUOTE CONVERSION REPORT
// ============================================================================
router.get('/quotes', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { startDate, endDate } = req.query;

    const where: any = {};
    const start = parseDateParam(startDate, 'startDate'); if (start) where.createdAt = { ...where.createdAt, gte: start };
    const end = parseDateParam(endDate, 'endDate'); if (end) where.createdAt = { ...where.createdAt, lte: end };

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalQuotes = quotes.length;
    const convertedQuotes = quotes.filter(q => q.convertedOrderId).length;
    const pendingQuotes = quotes.filter(q => q.status === 'Ready for Approval').length;
    const conversionRate = totalQuotes > 0 ? (convertedQuotes / totalQuotes) * 100 : 0;

    const techBreakdown: Record<string, number> = {};
    for (const q of quotes) {
      techBreakdown[q.technology] = (techBreakdown[q.technology] || 0) + 1;
    }

    ApiResponseHelper.success(res, {
      totalQuotes,
      convertedQuotes,
      pendingQuotes,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      techBreakdown,
      quotes,
    }, 'Quote conversion report generated');
  } catch (error: any) {
    if (error instanceof AppError) { ApiResponseHelper.error(res, error.code, error.message, error.statusCode); return; } ApiResponseHelper.error(res, 'QUOTE_REPORT_ERROR', 'Report could not be generated.', 500);
  }
});

// ============================================================================
// CAD UPLOAD REPORT
// ============================================================================
router.get('/cad-uploads', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { startDate, endDate } = req.query;

    const where: any = {};
    const start = parseDateParam(startDate, 'startDate'); if (start) where.createdAt = { ...where.createdAt, gte: start };
    const end = parseDateParam(endDate, 'endDate'); if (end) where.createdAt = { ...where.createdAt, lte: end };

    const cadFiles = await prisma.cadFile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalUploads = cadFiles.length;
    const successfulUploads = cadFiles.filter(f => f.status !== 'Failed').length;
    const failedUploads = cadFiles.filter(f => f.status === 'Failed').length;
    const processingUploads = cadFiles.filter(f => f.status === 'Analyzing').length;

    const formatBreakdown: Record<string, number> = {};
    for (const f of cadFiles) {
      formatBreakdown[f.format] = (formatBreakdown[f.format] || 0) + 1;
    }

    ApiResponseHelper.success(res, {
      totalUploads,
      successfulUploads,
      failedUploads,
      processingUploads,
      formatBreakdown,
      cadFiles,
    }, 'CAD upload report generated');
  } catch (error: any) {
    if (error instanceof AppError) { ApiResponseHelper.error(res, error.code, error.message, error.statusCode); return; } ApiResponseHelper.error(res, 'CAD_REPORT_ERROR', 'Report could not be generated.', 500);
  }
});

export default router;