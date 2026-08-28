import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { getManufacturingEngine } from '../providers/manufacturing';
import { requireAuth } from '../middleware/auth.middleware';
import { getPrismaClient } from '../config/database';
import { hasRole, ROLES } from '../auth/roles';
import { AppError, sendSafeRouteError } from '../utils/errors';

const router = Router();

/** Rank >= SUPPORT_ADMIN (support, finance, pricing, operations, admin, super). */
const CAN_VIEW_TRACKING_ROLE = ROLES.SUPPORT_ADMIN;
/** Rank >= OPERATIONS_ADMIN (operations, admin, super). */
const CAN_DISPATCH_ROLE = ROLES.OPERATIONS_ADMIN;

const TWO_SIDED_BOUNDS = {
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 10000,
};

/**
 * These legacy /manufacturing endpoints are informational previews for an
 * authenticated caller. They never persist and never charge the customer;
 * the authoritative, persisted flow lives under /quotes and /orders. Even so
 * the endpoints are hardened: ownership checks, quantity bounds, and safe
 * error responses keep them from becoming info-leak or fabrication tools.
 */

// POST /api/v1/manufacturing/quote
router.post('/quote', requireAuth, async (req: Request, res: Response) => {
  try {
    const quantity = Number(req.body?.quantity);
    const volumeCm3 = Number(req.body?.volumeCm3);
    const surfaceAreaCm2 = Number(req.body?.surfaceAreaCm2);
    if (!req.body?.materialId || !req.body?.technology) {
      throw new AppError('materialId and technology are required.', 400, 'VALIDATION_ERROR');
    }
    if (!Number.isFinite(quantity) || quantity < TWO_SIDED_BOUNDS.MIN_QUANTITY || quantity > TWO_SIDED_BOUNDS.MAX_QUANTITY) {
      throw new AppError(`quantity must be between ${TWO_SIDED_BOUNDS.MIN_QUANTITY} and ${TWO_SIDED_BOUNDS.MAX_QUANTITY}.`, 400, 'VALIDATION_ERROR');
    }
    if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0 || !Number.isFinite(surfaceAreaCm2) || surfaceAreaCm2 <= 0) {
      throw new AppError('volumeCm3 and surfaceAreaCm2 must be positive numbers.', 400, 'VALIDATION_ERROR');
    }

    const engine = getManufacturingEngine();
    const quoteResponse = await engine.calculateQuote(req.body);
    ApiResponseHelper.success(res, quoteResponse, 'Quote calculated by CAM LABS');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'QUOTE_CALCULATION_ERROR', message: 'Quote could not be calculated.' });
  }
});

// POST /api/v1/manufacturing/dispatch
router.post('/dispatch', requireAuth, async (req: Request, res: Response) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      throw new AppError('orderId is required.', 400, 'VALIDATION_ERROR');
    }
    const quantity = Number(req.body?.quantity || 1);
    if (!Number.isFinite(quantity) || quantity < TWO_SIDED_BOUNDS.MIN_QUANTITY || quantity > TWO_SIDED_BOUNDS.MAX_QUANTITY) {
      throw new AppError(`quantity must be between ${TWO_SIDED_BOUNDS.MIN_QUANTITY} and ${TWO_SIDED_BOUNDS.MAX_QUANTITY}.`, 400, 'VALIDATION_ERROR');
    }

    const order = await getPrismaClient().order.findUnique({ where: { id: orderId }, select: { id: true, userId: true } });
    if (!order) throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
    const isAdmin = req.auth?.role ? hasRole(req.auth.role, [CAN_DISPATCH_ROLE]) : false;
    if (order.userId !== req.auth?.id && !isAdmin) {
      throw new AppError('You do not have access to dispatch this order.', 403, 'FORBIDDEN');
    }

    const engine = getManufacturingEngine();
    const dispatchResult = await engine.dispatchOrder({ ...req.body, orderId });
    ApiResponseHelper.success(res, dispatchResult, 'Order queued in CAM LABS manufacturing', 201);
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'DISPATCH_ERROR', message: 'Order could not be dispatched.' });
  }
});

// GET /api/v1/manufacturing/status/:trackingId
router.get('/status/:trackingId', requireAuth, async (req: Request, res: Response) => {
  try {
    const trackingId = req.params.trackingId;
    const order = await getPrismaClient().order.findFirst({
      where: { trackingNum: trackingId },
      select: { id: true, userId: true },
    });
    if (order) {
      const isAdmin = req.auth?.role ? hasRole(req.auth.role, [CAN_VIEW_TRACKING_ROLE]) : false;
      if (order.userId !== req.auth?.id && !isAdmin) {
        throw new AppError('You do not have access to this manufacturing status.', 403, 'FORBIDDEN');
      }
    }

    const engine = getManufacturingEngine();
    const status = await engine.getOrderStatus(trackingId);
    ApiResponseHelper.success(res, status, 'Manufacturing status retrieved');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'STATUS_CHECK_ERROR', message: 'Status could not be retrieved.' });
  }
});

export default router;