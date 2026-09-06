import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { OrdersService } from '../services/orders.service';
import { getGuestCadId, requireAuth } from '../middleware/auth.middleware';
import { hasRole, ROLES } from '../auth/roles';
import { QuotesService } from '../services/quotes.service';
import { sendSafeRouteError } from '../utils/errors';
import { AdminService } from '../services/admin.service';

const router = Router();

/** Rank >= OPERATIONS_ADMIN (operations, admin, super admin). */
const ORDER_STAFF_ROLE = ROLES.OPERATIONS_ADMIN;

// GET /api/v1/orders
router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const isStaff = hasRole(req.auth!.role, [ORDER_STAFF_ROLE]);
    const userId = isStaff ? undefined : req.auth!.id;
    const orders = await OrdersService.getAllOrders(userId);
    ApiResponseHelper.success(res, orders, `${orders.length} manufacturing orders retrieved`);
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'ORDERS_FETCH_ERROR', message: 'Orders could not be retrieved.' });
  }
});

// GET /api/v1/orders/:id
router.get('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const order = await OrdersService.getOrderById(req.params.id);
    if (!order) {
      return ApiResponseHelper.error(res, 'ORDER_NOT_FOUND', `Order '${req.params.id}' not found`, 404);
    }
    if (order.userId !== req.auth!.id && !hasRole(req.auth!.role, [ORDER_STAFF_ROLE])) {
      return ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
    }
    ApiResponseHelper.success(res, order);
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'ORDER_FETCH_ERROR', message: 'Order could not be retrieved.' });
  }
});

// POST /api/v1/orders (Create and queue an internal CAM LABS manufacturing order)
router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const newOrder = await OrdersService.createOrder({ ...req.body, userId: req.auth!.id, guestCadId: getGuestCadId(req.headers.cookie) });
    ApiResponseHelper.success(res, newOrder, 'Order created and queued in CAM LABS manufacturing', 201);

    // Real business event: only after the order rows were successfully created.
    void AdminService.notifySafely({
      type: 'ORDER',
      entityType: 'ORDER',
      entityId: newOrder.id,
      title: 'New Order Received',
      message: `A new order has been created${req.body.partName ? ` for ${req.body.partName}` : ''}.`,
      metadata: {
        orderId: newOrder.id,
        customerId: req.auth!.id,
        partName: req.body.partName || null,
        type: 'ORDER',
      },
      priority: 'SUCCESS',
    });
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'ORDER_CREATE_ERROR', message: 'Order could not be created.', status: 500 });
  }
});

// POST /api/v1/orders/convert-quote/:quoteId (Convert approved quote to order)
router.post('/convert-quote/:quoteId', requireAuth, async (req: any, res: any) => {
  try {
    const quote = await QuotesService.getQuoteById(req.params.quoteId);
    if (!quote) {
      return ApiResponseHelper.error(res, 'QUOTE_NOT_FOUND', `Quote '${req.params.quoteId}' not found for conversion`, 404);
    }
    if (quote.userId !== req.auth!.id && !hasRole(req.auth!.role, [ORDER_STAFF_ROLE])) {
      return ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
    }
    const order = await OrdersService.convertQuoteToOrder(req.params.quoteId);
    ApiResponseHelper.success(res, order, 'Quote approved and converted to manufacturing order', 201);

    if (order?.id) {
      // Real business event: quote-to-order conversion succeeded.
      void AdminService.notifySafely({
        type: 'ORDER',
        entityType: 'ORDER',
        entityId: order.id,
        title: 'New Order Received',
        message: `A quote was approved and converted to a manufacturing order${quote.partName ? ` for ${quote.partName}` : ''}.`,
        metadata: {
          orderId: order.id,
          quoteId: quote.id,
          customerId: req.auth!.id,
          partName: quote.partName || null,
          type: 'ORDER',
        },
        priority: 'SUCCESS',
      });
    }
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'QUOTE_CONVERSION_ERROR', message: 'Quote could not be converted to an order.' });
  }
});

export default router;