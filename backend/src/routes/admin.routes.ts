import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponseHelper } from '../utils/response';
import { AdminService } from '../services/admin.service';
import { getPrismaClient } from '../config/database';
import { requireAnyAdmin, requireSuperAdmin, requireOperationsAdmin, requirePricingAdmin, requireSupportAdmin, requireFinanceAdmin } from '../middleware/admin.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { AppError } from '../utils/errors';
import { AdminAuthService } from '../services/admin-auth.service';
import { isRole } from '../auth/roles';

const router = Router();

// ============================================================================
// DASHBOARD
// ============================================================================

router.get('/dashboard', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await AdminService.getDashboardStats();
    ApiResponseHelper.success(res, stats, 'Dashboard statistics retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'DASHBOARD_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'ADMIN_USERS_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'UPDATE_ADMIN_ERROR', error.message, 400);
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

router.get('/orders', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, technology, manufacturerId, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status as string;
    if (technology) where.technology = technology as string;
    if (manufacturerId) where.manufacturerId = manufacturerId as string;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
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
          manufacturer: true,
          cadFiles: {
            include: {
              cadFile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.order.count({ where }),
    ]);

    ApiResponseHelper.success(res, { orders, total }, 'Orders retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'ORDERS_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'ORDER_ERROR', error.message, 500);
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
// MANUFACTURERS
// ============================================================================

router.get('/manufacturers', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, availability, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status as string;
    if (availability) where.availability = availability as string;

    const [manufacturers, total] = await Promise.all([
      prisma.manufacturer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.manufacturer.count({ where }),
    ]);

    ApiResponseHelper.success(res, { manufacturers, total }, 'Manufacturers retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'MANUFACTURERS_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'CREATE_MANUFACTURER_ERROR', error.message, 400);
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
    ApiResponseHelper.error(res, 'UPDATE_MANUFACTURER_ERROR', error.message, 400);
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
    ApiResponseHelper.error(res, 'MANUFACTURER_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'ASSIGNMENT_ERROR', error.message, 400);
  }
});

// ============================================================================
// MANUFACTURING REQUESTS
// ============================================================================

router.get('/manufacturing-requests', requireOperationsAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, manufacturerId, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status as string;
    if (manufacturerId) where.manufacturerId = manufacturerId as string;

    const [requests, total] = await Promise.all([
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
    ]);

    ApiResponseHelper.success(res, { requests, total }, 'Manufacturing requests retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'MANUFACTURING_REQUESTS_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'REQUEST_ERROR', error.message, 500);
  }
});

// ============================================================================
// CUSTOMERS
// ============================================================================

router.get('/customers', requireSupportAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.accountStatus = status as string;

    const [customers, total] = await Promise.all([
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
    ]);

    ApiResponseHelper.success(res, { customers, total }, 'Customers retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'CUSTOMERS_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'CUSTOMER_ERROR', error.message, 500);
  }
});

// ============================================================================
// QUOTES
// ============================================================================

router.get('/quotes', requireSupportAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status as string;

    const [quotes, total] = await Promise.all([
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
    ]);

    ApiResponseHelper.success(res, { quotes, total }, 'Quotes retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'QUOTES_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'QUOTE_ERROR', error.message, 500);
  }
});

// ============================================================================
// CAD FILES
// ============================================================================

router.get('/cad-files', requireSupportAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { status, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status as string;

    const [cadFiles, total] = await Promise.all([
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
    ]);

    ApiResponseHelper.success(res, { cadFiles, total }, 'CAD files retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'CAD_FILES_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'CAD_FILE_ERROR', error.message, 500);
  }
});

// ============================================================================
// MATERIALS
// ============================================================================

router.get('/materials', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { technology, category, isActive, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (technology) where.technology = technology as string;
    if (category) where.category = category as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.material.count({ where }),
    ]);

    ApiResponseHelper.success(res, { materials, total }, 'Materials retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'MATERIALS_ERROR', error.message, 500);
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
    const { status, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.paymentStatus = status as string;

    const [payments, total] = await Promise.all([
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
    ]);

    ApiResponseHelper.success(res, { payments, total }, 'Payments retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'PAYMENTS_ERROR', error.message, 500);
  }
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

router.get('/audit-logs', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, entityType, action, limit = 50, offset = 0 } = req.query;

    const { logs, total } = await AdminService.getAuditLogs({
      userId: userId as string,
      entityType: entityType as string,
      action: action as string,
      limit: Number(limit),
      offset: Number(offset),
    });

    ApiResponseHelper.success(res, { logs, total }, 'Audit logs retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'AUDIT_LOGS_ERROR', error.message, 500);
  }
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

router.get('/notifications', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const { unreadOnly } = req.query;
    const notifications = await AdminService.getNotifications(
      req.auth?.id,
      unreadOnly === 'true'
    );
    ApiResponseHelper.success(res, notifications, 'Notifications retrieved');
  } catch (error: any) {
    ApiResponseHelper.error(res, 'NOTIFICATIONS_ERROR', error.message, 500);
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
    ApiResponseHelper.error(res, 'NOTIFICATION_ERROR', error.message, 500);
  }
});

export default router;