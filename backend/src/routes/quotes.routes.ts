import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { QuotesService } from '../services/quotes.service';
import { requireAuth, resolveCadOwner } from '../middleware/auth.middleware';
import { hasRole } from '../auth/roles';

const router = Router();

// GET /api/v1/quotes
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = hasRole(req.auth!.role, ['ADMIN']) ? undefined : req.auth!.id;
    const quotes = await QuotesService.getAllQuotes(userId);
    ApiResponseHelper.success(res, quotes, `${quotes.length} quotations retrieved`);
  } catch (err: any) {
    ApiResponseHelper.error(res, 'QUOTES_FETCH_ERROR', err.message, 500);
  }
});

// GET /api/v1/quotes/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const quote = await QuotesService.getQuoteById(req.params.id);
    if (!quote) {
      return ApiResponseHelper.error(res, 'QUOTE_NOT_FOUND', `Quote '${req.params.id}' not found`, 404);
    }
    if (quote.userId !== req.auth!.id && !hasRole(req.auth!.role, ['ADMIN'])) {
      return ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
    }
    ApiResponseHelper.success(res, quote);
  } catch (err: any) {
    ApiResponseHelper.error(res, 'QUOTE_FETCH_ERROR', err.message, 500);
  }
});

// POST /api/v1/quotes/calculate (Calculate the final CAM LABS manufacturing price)
router.post('/calculate', resolveCadOwner, async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // NEW: Multi-file quotation (Phase 04)
    if (body.files && Array.isArray(body.files) && body.files.length > 0) {
      if (body.files.length > 20 || body.files.some((file: any) => !file.fileId || !file.materialId || !file.technology || !Number.isInteger(Number(file.quantity)) || Number(file.quantity) < 1)) {
        return ApiResponseHelper.error(res, 'INVALID_INPUT', 'Each quotation file requires a fileId, material, technology, and positive integer quantity.', 400);
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

    if (!materialId || !technology || !cadFileId || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 10000) {
      return ApiResponseHelper.error(res, 'INVALID_INPUT', 'cadFileId, materialId, technology, and quantity are required', 400);
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
    ApiResponseHelper.error(res, 'QUOTE_CALCULATION_ERROR', err.message, 500);
  }
});

// POST /api/v1/quotes (Save quote draft)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const quantity = Number(body.quantity);
    if (!body.partName || !body.technology || !body.material || !Number.isInteger(quantity) || quantity < 1) {
      return ApiResponseHelper.error(res, 'INVALID_INPUT', 'partName, technology, material, and a positive integer quantity are required.', 400);
    }

    if (body.files && Array.isArray(body.files) && body.files.length > 0) {
      const pricing = await QuotesService.calculateMultiFileQuotation({ files: body.files, cadOwner: { userId: req.auth!.id } });
      const savedQuote = await QuotesService.saveMultiFileQuotation({
        userId: req.auth!.id,
        partName: body.partName,
        technology: body.technology,
        material: body.material,
        quantity,
        toleranceGrade: body.toleranceGrade || 'standard',
        surfaceFinish: body.surfaceFinish || 'standard',
        cadFileIds: body.files.map((file: any) => file.fileId),
        pricing,
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
      partName: body.partName || 'Custom_Component.step',
      technology: body.technology || 'Industrial 3D Printing',
      material: body.material || 'PA 12 (Nylon 12)',
      quantity: Number(body.quantity) || 1,
      toleranceGrade: body.toleranceGrade || 'standard',
      surfaceFinish: body.surfaceFinish || 'Standard Bead-Blasted',
      cadFileIds: Array.isArray(body.cadFileIds) ? body.cadFileIds : undefined,
      pricing,
    });

    ApiResponseHelper.success(res, savedQuote, 'Quote saved successfully', 201);
  } catch (err: any) {
    ApiResponseHelper.error(res, 'QUOTE_SAVE_ERROR', err.message, 500);
  }
});

export default router;
