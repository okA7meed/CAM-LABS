import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { sendSafeRouteError } from '../utils/errors';
import { PricingAdminService } from '../services/pricing-admin.service';
import { requirePricingAdmin } from '../middleware/admin.middleware';

const router = Router();

// All pricing administration routes are protected by requirePricingAdmin,
// which authenticates the request and enforces PRICING_ADMIN/ADMIN/SUPER_ADMIN.
// There is no development-mode bypass; authorization is always enforced.

// GET /api/v1/admin/pricing/equations
router.get('/equations', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const equations = await PricingAdminService.getAllEquations();
    ApiResponseHelper.success(res, equations, 'Pricing equations retrieved');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'EQUATIONS_FETCH_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// GET /api/v1/admin/pricing/equations/:technology
router.get('/equations/:technology', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const details = await PricingAdminService.getEquationByTechnology(req.params.technology);
    ApiResponseHelper.success(res, details, `Equation details for ${req.params.technology} retrieved`);
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'EQUATION_FETCH_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// PUT /api/v1/admin/pricing/equations/:technology/draft
router.put('/equations/:technology/draft', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const { formulaTree, customVariables, constantsSnapshot, name, description } = req.body;
    if (!formulaTree) {
      return ApiResponseHelper.error(res, 'INVALID_INPUT', 'formulaTree is required to save a draft equation.', 400);
    }
    const draft = await PricingAdminService.saveDraft({
      technology: req.params.technology,
      formulaTree,
      customVariables: customVariables || [],
      constantsSnapshot,
      name,
      description,
    });
    ApiResponseHelper.success(res, draft, `Draft saved for ${req.params.technology}`);
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'DRAFT_SAVE_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

// POST /api/v1/admin/pricing/equations/:technology/test
router.post('/equations/:technology/test', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const { isDraft, modelContext, customVariablesOverride, formulaTreeOverride, constantsOverride } = req.body;
    if (!modelContext) {
      return ApiResponseHelper.error(res, 'INVALID_INPUT', 'modelContext is required for pricing test.', 400);
    }
    const result = await PricingAdminService.testEquation({
      technology: req.params.technology,
      isDraft: isDraft ?? true,
      modelContext,
      customVariablesOverride,
      formulaTreeOverride,
      constantsOverride,
    });
    ApiResponseHelper.success(res, result, 'Equation test calculation executed');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'TEST_CALCULATION_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

// POST /api/v1/admin/pricing/equations/:technology/compare
router.post('/equations/:technology/compare', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const { modelContext, draftFormulaOverride, draftCustomVariablesOverride } = req.body;
    if (!modelContext) {
      return ApiResponseHelper.error(res, 'INVALID_INPUT', 'modelContext is required for comparison.', 400);
    }
    const comparison = await PricingAdminService.compareDraftVsPublished({
      technology: req.params.technology,
      modelContext,
      draftFormulaOverride,
      draftCustomVariablesOverride,
    });
    ApiResponseHelper.success(res, comparison, 'Draft vs Published equation comparison calculated');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'COMPARISON_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

// POST /api/v1/admin/pricing/equations/:technology/publish
router.post('/equations/:technology/publish', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const publishedBy = req.auth?.email || req.auth?.id || 'PricingAdmin';
    const notes = req.body.notes || 'Published via Equation Builder';
    const result = await PricingAdminService.publishDraft({
      technology: req.params.technology,
      publishedBy,
      notes,
    });
    ApiResponseHelper.success(res, result, `Equation for ${req.params.technology} published successfully`);
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'PUBLISH_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

// GET /api/v1/admin/pricing/constants
router.get('/constants', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    await PricingAdminService.ensureInitialized();
    const { getPrismaClient } = await import('../config/database');
    const constants = await getPrismaClient().pricingConstant.findMany({
      orderBy: { key: 'asc' },
    });
    ApiResponseHelper.success(res, constants, 'Pricing constants retrieved');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'CONSTANTS_FETCH_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// POST /api/v1/admin/pricing/constants
router.post('/constants', requirePricingAdmin, async (req: Request, res: Response) => {
  try {
    const { key, name, value, unit, description, technology } = req.body;
    if (!key || !name || value === undefined || !unit) {
      return ApiResponseHelper.error(res, 'INVALID_INPUT', 'key, name, value, and unit are required for pricing constant.', 400);
    }
    const constant = await PricingAdminService.upsertConstant({
      key,
      name,
      value: Number(value),
      unit,
      description,
      technology,
    });
    ApiResponseHelper.success(res, constant, 'Pricing constant updated');
  } catch (err: any) {
    sendSafeRouteError(res, err, { code: 'CONSTANT_SAVE_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

export default router;
