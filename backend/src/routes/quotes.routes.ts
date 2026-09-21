import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { QuotesService } from '../services/quotes.service';
import { requireAuth, resolveCadOwner, getGuestCadId } from '../middleware/auth.middleware';
import { hasRole, ROLES } from '../auth/roles';
import { sendSafeRouteError } from '../utils/errors';
import { AdminService } from '../services/admin.service';
import { getActiveShippingMethods } from '../services/shipping.service';
import { CouponsService } from '../services/coupons.service';
import { QuoteSubmissionService } from '../services/quoteSubmission.service';
import { BusinessReferenceService } from '../services/businessReference.service';
import { QuoteDeletionService } from '../services/quoteDeletion.service';
import { getPrismaClient } from '../config/database';

const router = Router();

/** Rank >= SUPPORT_ADMIN (support, finance, pricing, operations, admin, super). */
const QUOTE_STAFF_ROLE = ROLES.SUPPORT_ADMIN;

const MAX_QUOTE_QUANTITY = 10000;

/**
 * Ensure a legacy-path quote carries the unified CAM business reference.
 * saveQuotation/saveMultiFileQuotation predate the reference model, so rows
 * created here would otherwise introduce new RFQ-style business-facing
 * references. Best-effort and non-blocking: failures only affect the
 * notification display, never the saved quote.
 */
async function ensureQuoteReference(quote: { id: string; reference?: string | null }): Promise<string | null> {
  try {
    if (quote.reference) return quote.reference;
    const prisma = getPrismaClient() as any;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reference = await BusinessReferenceService.generateUniqueReference();
      try {
        await prisma.quote.update({ where: { id: quote.id }, data: { reference } });
        return reference;
      } catch (err: any) {
        if (String(err?.code) !== 'P2002') throw err;
      }
    }
    return null;
  } catch {
    return (quote.reference as string) || null;
  }
}

// GET /api/v1/quotes
router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const isStaff = hasRole(req.auth!.role, [QUOTE_STAFF_ROLE]);
    const userId = isStaff ? undefined : req.auth!.id;
    const quotes = await QuotesService.getAllQuotes(userId);
    ApiResponseHelper.success(res, quotes, `${quotes.length} quotations retrieved`);
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'QUOTES_FETCH_ERROR', message: 'Quotations could not be retrieved.' });
  }
});

// GET /api/v1/quotes/shipping-rates — enabled Super Admin-controlled methods.
// NOTE: registered BEFORE /:id so "shipping-rates" is not captured as an id.
router.get('/shipping-rates', async (_req: Request, res: Response) => {
  try {
    const methods = await getActiveShippingMethods();
    ApiResponseHelper.success(
      res,
      {
        rates: methods.map((m) => ({
          id: m.code,
          code: m.code,
          label: `${m.name}${m.eta ? ` (${m.eta})` : ''}`,
          name: m.name,
          description: m.description,
          eta: m.eta,
          feeEgp: m.priceEgp,
        })),
        currency: 'EGP',
      },
      'Shipping rates retrieved',
    );
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'SHIPPING_RATES_ERROR', message: 'Shipping rates could not be retrieved.' });
  }
});

// GET /api/v1/quotes/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const quote = await QuotesService.getQuoteById(req.params.id);
    if (!quote) {
      return ApiResponseHelper.error(res, 'QUOTE_NOT_FOUND', `Quote '${req.params.id}' not found`, 404);
    }
    if (quote.userId !== req.auth!.id && !hasRole(req.auth!.role, [QUOTE_STAFF_ROLE])) {
      return ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
    }
    ApiResponseHelper.success(res, quote);
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'QUOTE_FETCH_ERROR', message: 'Quote could not be retrieved.' });
  }
});

// POST /api/v1/quotes/calculate (Calculate the final CAM LABS manufacturing price)
router.post('/calculate', resolveCadOwner, async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // NEW: Multi-file quotation (Phase 04)
    if (body.files && Array.isArray(body.files) && body.files.length > 0) {
      if (body.files.length > 20 || body.files.some((file: any) => !file.fileId || !file.materialId || !file.technology || !Number.isInteger(Number(file.quantity)) || Number(file.quantity) < 1 || Number(file.quantity) > MAX_QUOTE_QUANTITY)) {
        return ApiResponseHelper.error(res, 'INVALID_INPUT', 'Each quotation file requires a fileId, material, technology, and a quantity between 1 and 10000.', 400);
      }
      const normalizedFiles = body.files.map((file: any) => ({
        ...file,
        surfaceFinish: file.surfaceFinish || 'standard',
        toleranceGrade: file.toleranceGrade || 'standard',
      }));
      const quotation = await QuotesService.calculateMultiFileQuotation({
        files: normalizedFiles,
        cadOwner: req.cadOwner,
        customerNotes: body.customerNotes,
        preferredDelivery: body.preferredDelivery,
      });
      return ApiResponseHelper.success(res, quotation, 'Multi-file CAM LABS quotation calculated');
    }

    // LEGACY: Single-file quotation (backward compatibility)
    const { materialId, technology, surfaceFinish, toleranceGrade, quantity, fileName, cadFileId } = body;

    if (!materialId || !technology || !cadFileId || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > MAX_QUOTE_QUANTITY) {
      return ApiResponseHelper.error(res, 'INVALID_INPUT', 'cadFileId, materialId, technology, and quantity (1-10000) are required', 400);
    }

    const quotation = await QuotesService.calculateQuotation({
      materialId,
      technology,
      surfaceFinish: surfaceFinish || 'standard',
      toleranceGrade: toleranceGrade || 'standard',
      quantity: Number(quantity),
      cadFileId,
      cadOwner: req.cadOwner,
      fileName,
    });

    ApiResponseHelper.success(res, quotation, 'CAM LABS quotation calculated');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'QUOTE_CALCULATION_ERROR', message: 'Quotation could not be calculated.' });
  }
});

// POST /api/v1/quotes/validate-coupon (authenticated preview; final revalidation happens at submit)
router.post('/validate-coupon', requireAuth, async (req: any, res: any) => {
  try {
    const { code, subtotalAmount, shippingAmount } = req.body || {};
    const result = await CouponsService.validateForQuote({
      code: String(code || ''),
      userId: req.auth!.id,
      subtotalAmount: Number(subtotalAmount) || 0,
      shippingAmount: Number(shippingAmount) || 0,
    });
    ApiResponseHelper.success(res, {
      code: result.coupon.code,
      discountType: result.coupon.discountType,
      discountValue: Number(result.coupon.discountValue),
      eligibleAmount: result.eligibleAmount,
      discountAmount: result.discountAmount,
      amountAfterDiscount: result.amountAfterDiscount,
      currency: 'EGP',
    }, 'Coupon is valid');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'COUPON_INVALID', message: 'Coupon could not be applied.' });
  }
});

// POST /api/v1/quotes/submit (Submit Quote — creates a Quote ONLY, never an Order or payment)
router.post('/submit', requireAuth, async (req: any, res: any) => {
  try {
    const body = req.body || {};
    const { quote, pricing } = await QuoteSubmissionService.submit({
      userId: req.auth!.id,
      guestCadId: getGuestCadId(req.headers.cookie) || body.guestCadId,
      partName: body.partName,
      technology: body.technology,
      material: body.material,
      quantity: body.quantity,
      toleranceGrade: body.toleranceGrade,
      surfaceFinish: body.surfaceFinish,
      cadFileIds: body.cadFileIds,
      files: body.files,
      cadFileId: body.cadFileId,
      technicalNotes: body.technicalNotes,
      technicalDocumentIds: body.technicalDocumentIds,
      contact: body.contact,
      delivery: body.delivery,
      saveAddress: body.saveAddress,
      shippingMethod: body.shippingMethod,
      preferredPaymentMethod: body.preferredPaymentMethod,
      billingSameAsShipping: body.billingSameAsShipping,
      billingAddress: body.billingAddress,
      couponCode: body.couponCode,
    });
    void AdminService.notifySafely({
      type: 'QUOTE',
      entityType: 'QUOTE',
      entityId: quote.id,
      title: 'New Quote Submitted',
      message: `Quote ${quote.reference || quote.id} submitted for ${quote.partName}.`,
      metadata: { quoteId: quote.id, reference: (quote as any).reference || null, customerId: req.auth!.id, partName: quote.partName, type: 'QUOTE' },
      priority: 'INFO',
    });
    ApiResponseHelper.success(res, { quote, pricing }, 'Quote submitted successfully', 201);
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'QUOTE_SUBMIT_ERROR', message: 'Quote could not be submitted.' });
  }
});
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const quantity = Number(body.quantity);
    if (!body.partName || !body.technology || !body.material || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUOTE_QUANTITY) {
      return ApiResponseHelper.error(res, 'INVALID_INPUT', 'partName, technology, material, and a quantity between 1 and 10000 are required.', 400);
    }

    if (body.files && Array.isArray(body.files) && body.files.length > 0) {
      if (body.files.length > 20) {
        return ApiResponseHelper.error(res, 'INVALID_INPUT', 'A quotation can reference at most 20 CAD files.', 400);
      }
      const pricing = await QuotesService.calculateMultiFileQuotation({ files: body.files, cadOwner: { userId: req.auth!.id } });
      const savedQuote = await QuotesService.saveMultiFileQuotation({
        userId: req.auth!.id,
        guestCadId: getGuestCadId(req.headers.cookie),
        partName: body.partName,
        technology: body.technology,
        material: body.material,
        quantity,
        toleranceGrade: body.toleranceGrade || 'standard',
        surfaceFinish: body.surfaceFinish || 'standard',
        cadFileIds: body.files.map((file: any) => file.fileId),
        technicalNotes: typeof body.technicalNotes === 'string' ? body.technicalNotes.slice(0, 500) : '',
        technicalDocumentIds: Array.isArray(body.technicalDocumentIds) ? body.technicalDocumentIds.slice(0, 10).filter((id: unknown) => typeof id === 'string') : [],
        pricing,
      });
      // Real business event: only after the multi-file quote is committed.
      const multiReference = await ensureQuoteReference(savedQuote as { id: string; reference?: string | null });
      void AdminService.notifySafely({
        type: 'QUOTE',
        entityType: 'QUOTE',
        entityId: savedQuote.id,
        title: 'New Quote Received',
        message: `A new quote has been submitted${body.partName ? ` for ${body.partName}` : ''}.`,
        metadata: {
          quoteId: savedQuote.id,
          reference: multiReference,
          customerId: req.auth!.id,
          partName: savedQuote.partName || body.partName || null,
          type: 'QUOTE',
        },
        priority: 'INFO',
      });
      return ApiResponseHelper.success(res, savedQuote, 'Quote saved successfully', 201);
    }

    const pricing = await QuotesService.calculateQuotation({
      materialId: body.material,
      technology: body.technology,
      surfaceFinish: body.surfaceFinish || 'standard',
      toleranceGrade: body.toleranceGrade || 'standard',
      quantity,
      cadFileId: body.cadFileId,
      cadOwner: { userId: req.auth!.id },
    });

    const savedQuote = await QuotesService.saveQuotation({
      userId: req.auth!.id,
      guestCadId: getGuestCadId(req.headers.cookie),
      partName: body.partName || 'Custom_Component.step',
      technology: body.technology || 'Industrial 3D Printing',
      material: body.material || 'PA 12 (Nylon 12)',
      quantity: Number(body.quantity) || 1,
      toleranceGrade: body.toleranceGrade || 'standard',
      surfaceFinish: body.surfaceFinish || 'Standard Bead-Blasted',
      cadFileIds: Array.isArray(body.cadFileIds) ? body.cadFileIds : undefined,
      technicalNotes: typeof body.technicalNotes === 'string' ? body.technicalNotes.slice(0, 500) : '',
      technicalDocumentIds: Array.isArray(body.technicalDocumentIds) ? body.technicalDocumentIds.slice(0, 10).filter((id: unknown) => typeof id === 'string') : [],
      pricing,
    });

    ApiResponseHelper.success(res, savedQuote, 'Quote saved successfully', 201);

    // Real business event: never on a failed save — this runs only after the
    // quote row has been successfully committed.
    const singleReference = await ensureQuoteReference(savedQuote as { id: string; reference?: string | null });
    void AdminService.notifySafely({
      type: 'QUOTE',
      entityType: 'QUOTE',
      entityId: savedQuote.id,
      title: 'New Quote Received',
      message: `A new quote has been submitted${body.partName ? ` for ${body.partName}` : ''}.`,
      metadata: {
        quoteId: savedQuote.id,
        reference: singleReference,
        customerId: req.auth!.id,
        partName: savedQuote.partName || body.partName || null,
        type: 'QUOTE',
      },
      priority: 'INFO',
    });
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'QUOTE_SAVE_ERROR', message: 'Quote could not be saved.' });
  }
});

// POST /api/v1/quotes/:id/deletion-request — customer files a Quote deletion
// request (deletion-by-approval). NEVER deletes the row: the Quote stays
// visible with a "Deletion Requested" state until an authorized admin
// approves or rejects. Idempotent: an existing PENDING request is reused.
router.post('/:id/deletion-request', requireAuth, async (req: Request, res: Response) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
    const existing = await QuoteDeletionService.pendingForQuote(req.params.id);
    const request = await QuoteDeletionService.requestDeletion({
      quoteId: req.params.id,
      userId: req.auth!.id,
      reason,
    });
    void AdminService.notifySafely({
      type: 'QUOTE',
      entityType: 'QUOTE_DELETION_REQUEST',
      entityId: request.id,
      title: 'Quote Deletion Requested',
      message: `Customer requested deletion of quote ${req.params.id}.`,
      metadata: { quoteId: req.params.id, requestId: request.id, customerId: req.auth!.id, type: 'QUOTE_DELETION_REQUEST' },
      priority: 'WARNING',
    });
    ApiResponseHelper.success(
      res,
      request,
      existing
        ? 'A deletion request is already pending for this quote.'
        : 'Your quote deletion request has been sent. Please wait for CAM LABS approval.',
      existing ? 200 : 201,
    );
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'DELETION_REQUEST_ERROR', message: 'Deletion request could not be submitted.' });
  }
});

// GET /api/v1/quotes/:id/deletion-request — caller's latest request state.
router.get('/:id/deletion-request', requireAuth, async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient() as any;
    const quote = await prisma.quote.findUnique({ where: { id: req.params.id } });
    if (!quote || quote.userId !== req.auth!.id) {
      return ApiResponseHelper.error(res, 'QUOTE_NOT_FOUND', 'Quote not found.', 404);
    }
    const requests = await prisma.quoteDeletionRequest.findMany({
      where: { quoteId: req.params.id },
      orderBy: { requestedAt: 'desc' },
      take: 5,
    });
    ApiResponseHelper.success(res, { requests }, 'Deletion request state retrieved');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'DELETION_REQUEST_FETCH_ERROR', message: 'Deletion request could not be retrieved.' });
  }
});

// DELETE /api/v1/quotes/:id — direct customer deletion is DISABLED.
//
// Deletion-by-approval only: file POST /quotes/:id/deletion-request and wait
// for an authorized admin. This endpoint always refuses with 410 so no client
// (old or new) can delete a Quote row directly.
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  return ApiResponseHelper.error(
    res,
    'QUOTE_DELETE_DISABLED',
    'Direct quote deletion is disabled. Your quote deletion request has been sent. Please wait for CAM LABS approval.',
    410,
  );
});

export default router;