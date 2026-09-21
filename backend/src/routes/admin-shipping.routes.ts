import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponseHelper } from '../utils/response';
import { getPrismaClient } from '../config/database';
import { requireSuperAdmin, requireAnyAdmin } from '../middleware/admin.middleware';
import { sendSafeRouteError } from '../utils/errors';
import { AuditLogService } from '../services/auditLog.service';

const router = Router();

const CODE_RE = /^[A-Z0-9_]{2,32}$/;

const shippingMethodSchema = z.object({
  code: z.string().trim().min(2).max(32).transform((s) => s.toUpperCase().replace(/[\s-]+/g, '_')),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(''),
  eta: z.string().trim().max(60).optional().default(''),
  priceEgp: z.number().nonnegative().max(10000000),
  currency: z.string().trim().max(8).optional().default('EGP'),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

const serialize = (m: any) => ({
  ...m,
  effectiveStatus: m.archivedAt ? 'Archived' : m.isEnabled ? 'Active' : 'Inactive',
});

// GET /api/v1/admin/shipping/methods — list (any admin can view; mutations are super-admin only)
router.get('/methods', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient() as any;
    const includeArchived = String(req.query.includeArchived || '') === 'true';
    const methods = await prisma.shippingMethod.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });
    ApiResponseHelper.success(
      res,
      { methods: methods.map(serialize), total: methods.length },
      'Shipping methods retrieved',
    );
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'SHIPPING_FETCH_ERROR', message: 'Shipping methods could not be retrieved.' });
  }
});

// POST /api/v1/admin/shipping/methods — create (SUPER_ADMIN only)
router.post('/methods', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const parsed = shippingMethodSchema.parse(req.body);
    if (!CODE_RE.test(parsed.code)) {
      return ApiResponseHelper.error(res, 'SHIPPING_INVALID_CODE', 'Code must be 2–32 uppercase letters, digits or underscores.', 422);
    }
    const prisma = getPrismaClient() as any;
    const created = await prisma.shippingMethod.create({
      data: {
        code: parsed.code,
        name: parsed.name,
        description: parsed.description ?? '',
        eta: parsed.eta ?? '',
        priceEgp: parsed.priceEgp,
        currency: parsed.currency ?? 'EGP',
        isEnabled: parsed.isEnabled ?? true,
        sortOrder: parsed.sortOrder ?? 0,
      },
    });
    await AuditLogService.log({ userId: req.auth!.id, action: 'CREATE', entityType: 'SHIPPING_METHOD', entityId: created.id, newValue: created }).catch(() => undefined);
    ApiResponseHelper.success(res, serialize(created), 'Shipping method created successfully', 201);
  } catch (err: any) {
    if (err?.code === 'P2002') return ApiResponseHelper.error(res, 'SHIPPING_CODE_EXISTS', 'A shipping method with this code already exists.', 409);
    if (err?.name === 'ZodError') return ApiResponseHelper.error(res, 'INVALID_INPUT', 'Shipping method configuration is invalid.', 422);
    sendSafeRouteError(res, err, { code: 'SHIPPING_CREATE_ERROR', message: 'Shipping method could not be created.' });
  }
});

// PUT /api/v1/admin/shipping/methods/:id — edit (SUPER_ADMIN only; historical quote snapshots preserved)
router.put('/methods/:id', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const parsed = shippingMethodSchema.partial().parse(req.body);
    if (parsed.code && !CODE_RE.test(parsed.code)) {
      return ApiResponseHelper.error(res, 'SHIPPING_INVALID_CODE', 'Code must be 2–32 uppercase letters, digits or underscores.', 422);
    }
    const prisma = getPrismaClient() as any;
    const existing = await prisma.shippingMethod.findUnique({ where: { id: req.params.id } });
    if (!existing) return ApiResponseHelper.error(res, 'SHIPPING_NOT_FOUND', 'Shipping method not found.', 404);
    if (parsed.code && parsed.code !== existing.code) {
      const clash = await prisma.shippingMethod.findUnique({ where: { code: parsed.code } });
      if (clash) return ApiResponseHelper.error(res, 'SHIPPING_CODE_EXISTS', 'A shipping method with this code already exists.', 409);
    }
    const updated = await prisma.shippingMethod.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.code ? { code: parsed.code } : {}),
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.eta !== undefined ? { eta: parsed.eta } : {}),
        ...(parsed.priceEgp !== undefined ? { priceEgp: parsed.priceEgp } : {}),
        ...(parsed.currency ? { currency: parsed.currency } : {}),
        ...(parsed.isEnabled !== undefined ? { isEnabled: parsed.isEnabled } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
      },
    });
    await AuditLogService.log({ userId: req.auth!.id, action: 'UPDATE', entityType: 'SHIPPING_METHOD', entityId: updated.id, oldValue: existing, newValue: updated }).catch(() => undefined);
    ApiResponseHelper.success(res, serialize(updated), 'Shipping method updated successfully');
  } catch (err: any) {
    if (err?.name === 'ZodError') return ApiResponseHelper.error(res, 'INVALID_INPUT', 'Shipping method configuration is invalid.', 422);
    sendSafeRouteError(res, err, { code: 'SHIPPING_UPDATE_ERROR', message: 'Shipping method could not be updated.' });
  }
});

// POST /api/v1/admin/shipping/methods/:id/enable — re-enable (SUPER_ADMIN only)
router.post('/methods/:id/enable', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const prisma = getPrismaClient() as any;
    const updated = await prisma.shippingMethod.update({ where: { id: req.params.id }, data: { isEnabled: true, archivedAt: null } });
    await AuditLogService.log({ userId: req.auth!.id, action: 'UPDATE', entityType: 'SHIPPING_METHOD', entityId: updated.id, newValue: { isEnabled: true } }).catch(() => undefined);
    ApiResponseHelper.success(res, serialize(updated), 'Shipping method enabled');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'SHIPPING_UPDATE_ERROR', message: 'Shipping method could not be enabled.' });
  }
});

// POST /api/v1/admin/shipping/methods/:id/disable — disable (SUPER_ADMIN only; keeps history)
router.post('/methods/:id/disable', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const prisma = getPrismaClient() as any;
    const updated = await prisma.shippingMethod.update({ where: { id: req.params.id }, data: { isEnabled: false } });
    await AuditLogService.log({ userId: req.auth!.id, action: 'UPDATE', entityType: 'SHIPPING_METHOD', entityId: updated.id, newValue: { isEnabled: false } }).catch(() => undefined);
    ApiResponseHelper.success(res, serialize(updated), 'Shipping method disabled');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'SHIPPING_UPDATE_ERROR', message: 'Shipping method could not be disabled.' });
  }
});

// POST /api/v1/admin/shipping/methods/:id/archive — safe soft-delete (SUPER_ADMIN only)
router.post('/methods/:id/archive', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const prisma = getPrismaClient() as any;
    const updated = await prisma.shippingMethod.update({ where: { id: req.params.id }, data: { isEnabled: false, archivedAt: new Date() } });
    await AuditLogService.log({ userId: req.auth!.id, action: 'DELETE', entityType: 'SHIPPING_METHOD', entityId: updated.id, newValue: { archivedAt: updated.archivedAt } }).catch(() => undefined);
    ApiResponseHelper.success(res, serialize(updated), 'Shipping method archived');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'SHIPPING_UPDATE_ERROR', message: 'Shipping method could not be archived.' });
  }
});

export default router;
