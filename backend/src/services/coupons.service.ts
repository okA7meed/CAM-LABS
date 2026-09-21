import { getPrismaClient } from '../config/database';
import { AppError } from '../utils/errors';
import { Logger } from '../utils/logger';

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type DiscountScope = 'SUBTOTAL_ONLY' | 'INCLUDING_SHIPPING';

export interface CouponValidationResult {
  valid: true;
  coupon: any;
  eligibleAmount: number;
  discountAmount: number;
  shippingDiscount: number;
  amountAfterDiscount: number;
}

const normalizeCode = (code: string) => String(code || '').trim().toUpperCase();

function calcDiscount(params: {
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  eligibleAmount: number;
}): number {
  const { discountType, discountValue, maxDiscountAmount, eligibleAmount } = params;
  if (discountType === 'PERCENTAGE') {
    if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100) {
      throw new AppError('Coupon discount value is invalid.', 422, 'COUPON_INVALID_VALUE');
    }
    let amount = (eligibleAmount * discountValue) / 100;
    if (maxDiscountAmount != null && Number.isFinite(maxDiscountAmount) && maxDiscountAmount >= 0) {
      amount = Math.min(amount, maxDiscountAmount);
    }
    return Math.max(0, Math.min(amount, eligibleAmount));
  }
  if (discountType === 'FIXED') {
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new AppError('Coupon discount value is invalid.', 422, 'COUPON_INVALID_VALUE');
    }
    return Math.max(0, Math.min(discountValue, eligibleAmount));
  }
  throw new AppError('Coupon discount type is invalid.', 422, 'COUPON_INVALID_TYPE');
}

/**
 * Coupons — backend is the single source of truth.
 * Frontend values (percent/amount/state/subtotal/shipping/total) are never trusted.
 */
export class CouponsService {
  static normalizeCode = normalizeCode;

  /** Validate a coupon for a given customer + eligible amounts (no write). */
  static async validateForQuote(params: {
    code: string;
    userId: string;
    subtotalAmount: number;
    shippingAmount?: number;
    quoteId?: string;
    now?: Date;
  }): Promise<CouponValidationResult> {
    const prisma = getPrismaClient() as any;
    const code = normalizeCode(params.code);
    if (!code) throw new AppError('A coupon code is required.', 400, 'COUPON_REQUIRED');
    if (!params.userId) throw new AppError('Authentication is required to apply a coupon.', 401, 'COUPON_AUTH_REQUIRED');

    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon || coupon.archivedAt) throw new AppError('This coupon code is invalid.', 404, 'COUPON_INVALID');
    if (!coupon.isEnabled) throw new AppError('This coupon is currently disabled.', 409, 'COUPON_DISABLED');

    const now = params.now || new Date();
    if (coupon.startAt && new Date(coupon.startAt) > now) {
      throw new AppError('This coupon is not active yet.', 409, 'COUPON_SCHEDULED');
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
      throw new AppError('This coupon has expired.', 409, 'COUPON_EXPIRED');
    }

    const subtotal = Number(params.subtotalAmount) || 0;
    const shipping = Number(params.shippingAmount) || 0;
    if (subtotal < 0 || shipping < 0) throw new AppError('Quote amounts are invalid.', 400, 'COUPON_INVALID_AMOUNT');

    const scope: DiscountScope = coupon.discountScope === 'INCLUDING_SHIPPING' ? 'INCLUDING_SHIPPING' : 'SUBTOTAL_ONLY';
    // If the coupon does not apply to shipping, only the subtotal is eligible.
    const eligibleAmount = scope === 'INCLUDING_SHIPPING' && coupon.appliesToShipping ? subtotal + shipping : subtotal;

    if (coupon.minQuoteAmount != null && eligibleAmount < Number(coupon.minQuoteAmount)) {
      throw new AppError(
        `This coupon requires a minimum quote amount of ${Number(coupon.minQuoteAmount).toFixed(2)} EGP.`,
        409,
        'COUPON_MIN_AMOUNT',
      );
    }

    if (coupon.maxTotalUses != null) {
      const totalCount = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
      if (totalCount >= Number(coupon.maxTotalUses)) {
        throw new AppError('This coupon has reached its maximum number of uses.', 409, 'COUPON_USAGE_LIMIT');
      }
    }
    if (coupon.usageLimitPerCustomer != null) {
      const mine = await prisma.couponUsage.count({ where: { couponId: coupon.id, userId: params.userId } });
      if (mine >= Number(coupon.usageLimitPerCustomer)) {
        throw new AppError('You have already used this coupon the maximum number of times.', 409, 'COUPON_CUSTOMER_LIMIT');
      }
    }

    const discountAmount = calcDiscount({
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      maxDiscountAmount: coupon.maxDiscountAmount != null ? Number(coupon.maxDiscountAmount) : null,
      eligibleAmount,
    });

    // Shipping discount portion (only when scope includes shipping; otherwise 0).
    const shippingDiscount = 0;
    const amountAfterDiscount = Math.max(0, eligibleAmount - discountAmount);

    return { valid: true, coupon, eligibleAmount, discountAmount, shippingDiscount, amountAfterDiscount };
  }

  /**
   * Atomically consume one coupon use inside the caller's transaction.
   * Concurrency-safe: global cap enforced via conditional counter increment,
   * per-customer cap re-checked inside the transaction.
   */
  static async consumeInTransaction(
    tx: any,
    params: {
      code: string;
      userId: string;
      quoteId: string;
      quoteReference?: string | null;
      eligibleAmount: number;
      discountAmount: number;
      amountAfterDiscount: number;
      shippingDiscount?: number;
    },
  ) {
    const code = normalizeCode(params.code);
    const coupon = await tx.coupon.findUnique({ where: { code } });
    if (!coupon || coupon.archivedAt) throw new AppError('This coupon code is invalid.', 404, 'COUPON_INVALID');
    if (!coupon.isEnabled) throw new AppError('This coupon is currently disabled.', 409, 'COUPON_DISABLED');
    const now = new Date();
    if (coupon.startAt && new Date(coupon.startAt) > now) throw new AppError('This coupon is not active yet.', 409, 'COUPON_SCHEDULED');
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) throw new AppError('This coupon has expired.', 409, 'COUPON_EXPIRED');

    // Re-check per-customer limit inside tx.
    if (coupon.usageLimitPerCustomer != null) {
      const mine = await tx.couponUsage.count({ where: { couponId: coupon.id, userId: params.userId } });
      if (mine >= Number(coupon.usageLimitPerCustomer)) {
        throw new AppError('You have already used this coupon the maximum number of times.', 409, 'COUPON_CUSTOMER_LIMIT');
      }
    }

    // Global cap: atomic increment only when under cap. If maxTotalUses is set,
    // a concurrent last-use race resolves to exactly one winner.
    if (coupon.maxTotalUses != null) {
      const claimed = await tx.coupon.updateMany({
        where: { id: coupon.id, totalUses: { lt: Number(coupon.maxTotalUses) } },
        data: { totalUses: { increment: 1 } },
      });
      if (claimed.count !== 1) {
        throw new AppError('This coupon has reached its maximum number of uses.', 409, 'COUPON_USAGE_LIMIT');
      }
    } else {
      await tx.coupon.update({ where: { id: coupon.id }, data: { totalUses: { increment: 1 } } });
    }

    const usage = await tx.couponUsage.create({
      data: {
        couponId: coupon.id,
        userId: params.userId,
        quoteId: params.quoteId,
        couponCodeSnapshot: coupon.code,
        discountTypeSnapshot: coupon.discountType,
        discountValueSnapshot: Number(coupon.discountValue),
        eligibleAmountSnapshot: Number(params.eligibleAmount),
        discountAmountApplied: Number(params.discountAmount),
        amountAfterDiscount: Number(params.amountAfterDiscount),
        shippingDiscountApplied: Number(params.shippingDiscount || 0),
        quoteReference: params.quoteReference || null,
      },
    });

    Logger.info(`[CouponsService] Consumed ${coupon.code} for user ${params.userId} quote ${params.quoteId}`);
    return { coupon, usage };
  }

  /** Admin analytics: totals + per-usage history. */
  static async analytics(couponId: string) {
    const prisma = getPrismaClient() as any;
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new AppError('Coupon not found.', 404, 'COUPON_NOT_FOUND');
    const usages = await prisma.couponUsage.findMany({
      where: { couponId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const totalUses = await prisma.couponUsage.count({ where: { couponId } });
    const uniqueCustomers = new Set(usages.map((u: any) => u.userId).filter(Boolean)).size;
    const remainingUses = coupon.maxTotalUses != null ? Math.max(0, Number(coupon.maxTotalUses) - totalUses) : null;
    return { coupon, totalUses, uniqueCustomers, remainingUses, usages };
  }

  static effectiveStatus(coupon: any, totalUses?: number): 'Active' | 'Inactive' | 'Scheduled' | 'Expired' | 'Usage Limit Reached' | 'Archived' {
    const now = new Date();
    if (coupon.archivedAt) return 'Archived';
    if (!coupon.isEnabled) return 'Inactive';
    if (coupon.startAt && new Date(coupon.startAt) > now) return 'Scheduled';
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return 'Expired';
    if (coupon.maxTotalUses != null && (totalUses ?? coupon.totalUses ?? 0) >= Number(coupon.maxTotalUses)) return 'Usage Limit Reached';
    return 'Active';
  }
}
