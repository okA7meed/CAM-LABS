import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { OrdersService } from '../services/orders.service';
import { getGuestCadId, requireAuth } from '../middleware/auth.middleware';
import { hasRole } from '../auth/roles';
import { QuotesService } from '../services/quotes.service';

const router = Router();

// GET /api/v1/orders
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = hasRole(req.auth!.role, ['ADMIN']) ? undefined : req.auth!.id;
    const orders = await OrdersService.getAllOrders(userId);
    ApiResponseHelper.success(res, orders, `${orders.length} manufacturing orders retrieved`);
  } catch (err: any) {
    ApiResponseHelper.error(res, 'ORDERS_FETCH_ERROR', err.message, 500);
  }
});

// GET /api/v1/orders/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const order = await OrdersService.getOrderById(req.params.id);
    if (!order) {
      return ApiResponseHelper.error(res, 'ORDER_NOT_FOUND', `Order '${req.params.id}' not found`, 404);
    }
    if (order.userId !== req.auth!.id && !hasRole(req.auth!.role, ['ADMIN'])) {
      return ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
    }
    ApiResponseHelper.success(res, order);
  } catch (err: any) {
    ApiResponseHelper.error(res, 'ORDER_FETCH_ERROR', err.message, 500);
  }
});

// POST /api/v1/orders (Create and queue an internal CAM LABS manufacturing order)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const newOrder = await OrdersService.createOrder({ ...req.body, userId: req.auth!.id, guestCadId: getGuestCadId(req.headers.cookie) });
    ApiResponseHelper.success(res, newOrder, 'Order created and queued in CAM LABS manufacturing', 201);
  } catch (err: any) {
    const status = /quote|quoted|configuration|CAD files/i.test(err.message) ? 409 : 500;
    ApiResponseHelper.error(res, 'ORDER_CREATE_ERROR', err.message, status);
  }
});

// POST /api/v1/orders/convert-quote/:quoteId (Convert approved quote to order)
router.post('/convert-quote/:quoteId', requireAuth, async (req: Request, res: Response) => {
  try {
    const quote = await QuotesService.getQuoteById(req.params.quoteId);
    if (quote && quote.userId !== req.auth!.id && !hasRole(req.auth!.role, ['ADMIN'])) {
      return ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
    }
    const order = await OrdersService.convertQuoteToOrder(req.params.quoteId);
    if (!order) {
      return ApiResponseHelper.error(res, 'QUOTE_NOT_FOUND', `Quote '${req.params.quoteId}' not found for conversion`, 404);
    }
    ApiResponseHelper.success(res, order, 'Quote approved and converted to manufacturing order', 201);
  } catch (err: any) {
    const status = /quote|expired|invalid/i.test(err.message) ? 409 : 500;
    ApiResponseHelper.error(res, 'QUOTE_CONVERSION_ERROR', err.message, status);
  }
});

export default router;
