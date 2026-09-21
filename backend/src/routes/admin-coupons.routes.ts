import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponseHelper } from '../utils/response';
import { getPrismaClient } from '../config/database';
import { requireSuperAdmin, requireAnyAdmin } from '../middleware/admin.middleware';
import { sendSafeRouteError } from '../utils/errors';
import { CouponsService } from '../services/coupons.service';
import { AuditLogService } from '../services/auditLog.service';

const router = Router();

const couponSchema = z.object({
  code: z.string().trim().min(2).max(32),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().positive().max(1000000),
  maxDiscountAmount: z.number().nonnegative().nullable().optional(),
  minQuoteAmount: z.number().nonnegative().nullable().optional(),
  maxTotalUses: z.number().int().positive().nullable().optional(),
  usageLimitPerCustomer: z.number().int().positive().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isEnabled: z.boolean().optional(),
  discountScope: z.enum(['SUBTOTAL_ONLY', 'INCLUDING_SHIPPING']).optional(),
  appliesToShipping: z.boolean().optional(),
});

function serializeCoupon(coupon: any, totalUses?: number) {
  const uses = totalUses ?? coupon.totalUses ?? 0;
  return {
    ...coupon,
    code: coupon.code,
    effectiveStatus: CouponsService.effectiveStatus(coupon, uses),
    remainingUses: coupon.maxTotalUses != null ? Math.max(0, Number(coupon.maxTotalUses) - uses) : null,
  };
}

// GET /api/v1/admin/coupons — list (any admin can view; mutations are super-admin only)
router.get('/', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient() as any;
    const includeArchived = String(req.query.includeArchived || '') === 'true';
    const coupons = await prisma.coupon.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    // Attach live usage counts (never trust stored counter alone for display).
    const withCounts = await Promise.all(
      coupons.map(async (c: any) => {
        const totalUses = await prisma.couponUsage.count({ where: { couponId: c.id } });
        return serializeCoupon(c, totalUses);
      }),
    );
    ApiResponseHelper.success(res, { coupons: withCounts, total: withCounts.length }, 'Coupons retrieved');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'COUPONS_FETCH_ERROR', message: 'Coupons could not be retrieved.' });
  }
});

// GET /api/v1/admin/coupons/:id — detail + analytics
router.get('/:id', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const data = await CouponsService.analytics(req.params.id);
    const coupon = serializeCoupon(data.coupon, data.totalUses);
    ApiResponseHelper.success(res, { ...data, coupon }, 'Coupon details retrieved');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'COUPON_FETCH_ERROR', message: 'Coupon could not be retrieved.' });
  }
});

// POST /api/v1/admin/coupons — create (SUPER_ADMIN only)
router.post('/', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const parsed = couponSchema.parse(req.body);
    const prisma = getPrismaClient() as any;
    const code = CouponsService.normalizeCode(parsed.code);
    if (parsed.discountType === 'PERCENTAGE' && (parsed.discountValue <= 0 || parsed.discountValue > 100)) {
      return ApiResponseHelper.error(res, 'COUPON_INVALID_VALUE', 'Percentage discount must be between 0 and 100.', 422);
    }
    const created = await prisma.coupon.create({
      data: {
        code,
        discountType: parsed.discountType,
        discountValue: parsed.discountValue,
        maxDiscountAmount: parsed.maxDiscountAmount ?? null,
        minQuoteAmount: parsed.minQuoteAmount ?? null,
        maxTotalUses: parsed.maxTotalUses ?? null,
        usageLimitPerCustomer: parsed.usageLimitPerCustomer ?? null,
        startAt: parsed.startAt ? new Date(parsed.startAt) : null,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        isEnabled: parsed.isEnabled ?? true,
        discountScope: parsed.discountScope ?? 'SUBTOTAL_ONLY',
        appliesToShipping: parsed.appliesToShipping ?? false,
        createdBy: req.auth!.id,
      },
    });
    await AuditLogService.log({ userId: req.auth!.id, action: 'CREATE', entityType: 'COUPON', entityId: created.id, newValue: created }).catch(() => undefined);
    ApiResponseHelper.success(res, serializeCoupon(created, 0), 'Coupon created successfully', 201);
  } catch (err: any) {
    if (err?.code === 'P2002') return ApiResponseHelper.error(res, 'COUPON_CODE_EXISTS', 'A coupon with this code already exists.', 409);
    if (err?.name === 'ZodError') return ApiResponseHelper.error(res, 'INVALID_INPUT', 'Coupon configuration is invalid.', 422);
    sendSafeRouteError(res, err, { code: 'COUPON_CREATE_ERROR', message: 'Coupon could not be created.' });
  }
});

// PUT /api/v1/admin/coupons/:id — edit (SUPER_ADMIN only; historical snapshots preserved on quotes/usages)
router.put('/:id', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const parsed = couponSchema.partial().parse(req.body);
    const prisma = getPrismaClient() as any;
    const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!existing) return ApiResponseHelper.error(res, 'COUPON_NOT_FOUND', 'Coupon not found.', 404);
    if (parsed.code) {
      const code = CouponsService.normalizeCode(parsed.code);
      if (code !== existing.code) {
        const clash = await prisma.coupon.findUnique({ where: { code } });
        if (clash) return ApiResponseHelper.error(res, 'COUPON_CODE_EXISTS', 'A coupon with this code already exists.', 409);
      }
    }
    if (parsed.discountType === 'PERCENTAGE' || (parsed.discountValue != null && existing.discountType === 'PERCENTAGE')) {
      const v = parsed.discountValue ?? existing.discountValue;
      if (Number(v) <= 0 || Number(v) > 100) return ApiResponseHelper.error(res, 'COUPON_INVALID_VALUE', 'Percentage discount must be between 0 and 100.', 422);
    }
    const updated = await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.code ? { code: CouponsService.normalizeCode(parsed.code) } : {}),
        ...(parsed.discountType ? { discountType: parsed.discountType } : {}),
        ...(parsed.discountValue != null ? { discountValue: parsed.discountValue } : {}),
        ...(parsed.maxDiscountAmount !== undefined ? { maxDiscountAmount: parsed.maxDiscountAmount } : {}),
        ...(parsed.minQuoteAmount !== undefined ? { minQuoteAmount: parsed.minQuoteAmount } : {}),
        ...(parsed.maxTotalUses !== undefined ? { maxTotalUses: parsed.maxTotalUses } : {}),
        ...(parsed.usageLimitPerCustomer !== undefined ? { usageLimitPerCustomer: parsed.usageLimitPerCustomer } : {}),
        ...(parsed.startAt !== undefined ? { startAt: parsed.startAt ? new Date(parsed.startAt) : null } : {}),
        ...(parsed.expiresAt !== undefined ? { expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null } : {}),
        ...(parsed.isEnabled !== undefined ? { isEnabled: parsed.isEnabled } : {}),
        ...(parsed.discountScope ? { discountScope: parsed.discountScope } : {}),
        ...(parsed.appliesToShipping !== undefined ? { appliesToShipping: parsed.appliesToShipping } : {}),
      },
    });
    await AuditLogService.log({ userId: req.auth!.id, action: 'UPDATE', entityType: 'COUPON', entityId: updated.id, oldValue: existing, newValue: updated }).catch(() => undefined);
    const totalUses = await prisma.couponUsage.count({ where: { couponId: updated.id } });
    ApiResponseHelper.success(res, serializeCoupon(updated, totalUses), 'Coupon updated successfully');
  } catch (err: any) {
    if (err?.name === 'ZodError') return ApiResponseHelper.error(res, 'INVALID_INPUT', 'Coupon configuration is invalid.', 422);
    sendSafeRouteError(res, err, { code: 'COUPON_UPDATE_ERROR', message: 'Coupon could not be updated.' });
  }
});

// POST /api/v1/admin/coupons/:id/enable|disable — activate/reactivate/disable (SUPER_ADMIN only)
router.post('/:id/enable', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const prisma = getPrismaClient() as any;
    const updated = await prisma.coupon.update({ where: { id: req.params.id }, data: { isEnabled: true, archivedAt: null } });
    await AuditLogService.log({ userId: req.auth!.id, action: 'UPDATE', entityType: 'COUPON', entityId: updated.id, newValue: { isEnabled: true } }).catch(() => undefined);
    ApiResponseHelper.success(res, serializeCoupon(updated), 'Coupon enabled');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'COUPON_UPDATE_ERROR', message: 'Coupon could not be enabled.' });
  }
});

router.post('/:id/disable', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const prisma = getPrismaClient() as any;
    const updated = await prisma.coupon.update({ where: { id: req.params.id }, data: { isEnabled: false } });
    await AuditLogService.log({ userId: req.auth!.id, action: 'UPDATE', entityType: 'COUPON', entityId: updated.id, newValue: { isEnabled: false } }).catch(() => undefined);
    ApiResponseHelper.success(res, serializeCoupon(updated), 'Coupon disabled');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'COUPON_UPDATE_ERROR', message: 'Coupon could not be disabled.' });
  }
});

// POST /api/v1/admin/coupons/:id/archive — safe soft-delete (SUPER_ADMIN only; history preserved)
router.post('/:id/archive', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const prisma = getPrismaClient() as any;
    const updated = await prisma.coupon.update({ where: { id: req.params.id }, data: { isEnabled: false, archivedAt: new Date() } });
    await AuditLogService.log({ userId: req.auth!.id, action: 'DELETE', entityType: 'COUPON', entityId: updated.id, newValue: { archivedAt: updated.archivedAt } }).catch(() => undefined);
    ApiResponseHelper.success(res, serializeCoupon(updated), 'Coupon archived');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'COUPON_UPDATE_ERROR', message: 'Coupon could not be archived.' });
  }
});

export default router;
