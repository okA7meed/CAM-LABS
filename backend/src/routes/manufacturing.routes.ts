import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { getManufacturingEngine } from '../providers/manufacturing';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// POST /api/v1/manufacturing/quote
router.post('/quote', requireAuth, async (req: Request, res: Response) => {
  try {
    const engine = getManufacturingEngine();
    const quoteResponse = await engine.calculateQuote(req.body);
    ApiResponseHelper.success(res, {
      ...quoteResponse,
    }, 'Quote calculated by CAM LABS');
  } catch (err: any) {
    ApiResponseHelper.error(res, 'QUOTE_CALCULATION_ERROR', err.message, 500);
  }
});

// POST /api/v1/manufacturing/dispatch
router.post('/dispatch', requireAuth, async (req: Request, res: Response) => {
  try {
    const engine = getManufacturingEngine();
    const dispatchResult = await engine.dispatchOrder(req.body);
    ApiResponseHelper.success(res, dispatchResult, 'Order queued in CAM LABS manufacturing', 201);
  } catch (err: any) {
    ApiResponseHelper.error(res, 'DISPATCH_ERROR', err.message, 500);
  }
});

// GET /api/v1/manufacturing/status/:trackingId
router.get('/status/:trackingId', requireAuth, async (req: Request, res: Response) => {
  try {
    const engine = getManufacturingEngine();
    const status = await engine.getOrderStatus(req.params.trackingId);
    ApiResponseHelper.success(res, status, 'Manufacturing status retrieved');
  } catch (err: any) {
    ApiResponseHelper.error(res, 'STATUS_CHECK_ERROR', err.message, 500);
  }
});

export default router;
