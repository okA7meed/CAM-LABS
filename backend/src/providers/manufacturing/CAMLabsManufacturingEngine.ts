import {
  IManufacturingEngine,
  ManufacturingDispatchResult,
  ManufacturingOrderDispatch,
  ManufacturingQuoteRequest,
  ManufacturingQuoteResponse,
} from './IManufacturingProvider';
import { MANUFACTURING_PRICING_CONFIGURATION } from '../../services/pricing-config.service';
import { Logger } from '../../utils/logger';
import { FdmSlicerService } from '../../services/fdm-slicer.service';
import { randomBytes } from 'crypto';

const INTERNAL_NODE = 'CAM-LABS-INTERNAL-CELL-01';

const LEAD_TIME_DAYS_BY_TECHNOLOGY: Record<string, number> = {
  FDM: 2,
  SLS: 3,
  SLA: 2,
  'CNC': 4,
  'CNC_MILLING': 4,
  'CNC_TURNING': 4,
  DMLS: 6,
  'SHEET_METAL': 3,
};

const leadTimeDaysFor = (technology: string): number => {
  const key = technology.toUpperCase();
  return LEAD_TIME_DAYS_BY_TECHNOLOGY[key] ?? 3;
};

export class CAMLabsManufacturingEngine implements IManufacturingEngine {
  readonly name = 'CAM LABS' as const;

  async calculateQuote(request: ManufacturingQuoteRequest): Promise<ManufacturingQuoteResponse> {
    if (request.technology.toUpperCase() !== 'FDM') throw new Error(`Pricing is not supported for ${request.technology}.`);
    const volumeCm3 = request.volumeCm3;
    const surfaceAreaCm2 = request.surfaceAreaCm2;
    const dimensions = request.dimensionsMm;
    if (!Number.isFinite(volumeCm3) || !Number.isFinite(surfaceAreaCm2) || !dimensions || volumeCm3! <= 0 || surfaceAreaCm2! <= 0 || Object.values(dimensions).some((value) => !Number.isFinite(value) || value <= 0)) {
      throw new Error('Validated geometry is required before pricing.');
    }
    const validatedVolumeCm3 = volumeCm3 as number;
    const validatedSurfaceAreaCm2 = surfaceAreaCm2 as number;
    const parameters = request.manufacturingParameters || {};
    const layerHeight = parameters.layerHeightMm ?? MANUFACTURING_PRICING_CONFIGURATION.defaultLayerHeightMm;
    const infillPercent = parameters.infillPercent ?? MANUFACTURING_PRICING_CONFIGURATION.defaultInfillPercent;
    const infill = infillPercent / 100;
    const wallCount = parameters.wallCount ?? MANUFACTURING_PRICING_CONFIGURATION.defaultWallCount;
    const lineWidth = parameters.lineWidthMm ?? MANUFACTURING_PRICING_CONFIGURATION.defaultLineWidthMm;
    const speed = parameters.printSpeedMmPerSecond ?? MANUFACTURING_PRICING_CONFIGURATION.defaultPrintSpeedMmPerSecond;
    const supportEnabled = parameters.supportEnabled ?? false;
    const wasteFactorPercent = parameters.wasteFactorPercent ?? MANUFACTURING_PRICING_CONFIGURATION.wasteFactorPercent;
    const perLayerOverheadSeconds = parameters.perLayerOverheadSeconds ?? MANUFACTURING_PRICING_CONFIGURATION.perLayerOverheadSeconds;
    const travelOverheadPercent = parameters.travelOverheadPercent ?? MANUFACTURING_PRICING_CONFIGURATION.travelOverheadPercent;
    const productionLaborMinutes = parameters.productionLaborMinutes ?? MANUFACTURING_PRICING_CONFIGURATION.productionLaborMinutes;
    const postProcessingMinutes = parameters.postProcessingMinutes ?? MANUFACTURING_PRICING_CONFIGURATION.postProcessingMinutes;
    if (layerHeight <= 0 || infill < 0 || infill > 1 || wallCount < 1 || lineWidth <= 0 || speed <= 0 || wasteFactorPercent < 0 || perLayerOverheadSeconds < 0 || travelOverheadPercent < 0 || productionLaborMinutes < 0 || postProcessingMinutes < 0) {
      throw new Error('Invalid FDM manufacturing parameters.');
    }
    if (layerHeight > 1 || layerHeight >= dimensions.height) throw new Error('Layer height is incompatible with the analyzed model height.');
    const materialPrice = MANUFACTURING_PRICING_CONFIGURATION.materialPriceEgpPerGram[request.materialId.toLowerCase()];
    const density = MANUFACTURING_PRICING_CONFIGURATION.materialDensityGramsPerCm3[request.materialId.toLowerCase()];
    const rates = MANUFACTURING_PRICING_CONFIGURATION;
    if (!materialPrice || !density || [rates.machineHourlyRateEgp, rates.laborHourlyRateEgp, rates.setupTimeMinutes, rates.productionLaborMinutes, rates.setupConsumablesEgp, rates.minimumOrderPriceEgp, rates.wasteFactorPercent, rates.supportSurfaceFractionFactor, rates.supportVolumeFactor].some((value) => !Number.isFinite(value))) throw new Error('CAM LABS EGP manufacturing rates are not configured.');
    if (!request.modelData) throw new Error('FDM slicer input is unavailable for the analyzed CAD file.');
    const wallVolumeCm3 = Math.min(validatedVolumeCm3, validatedSurfaceAreaCm2 * (layerHeight / 10) * wallCount);
    const depositedMaterialVolumeCm3 = wallVolumeCm3 + Math.max(0, validatedVolumeCm3 - wallVolumeCm3) * infill;
    const surfaceToVolumeRatio = validatedSurfaceAreaCm2 / Math.pow(validatedVolumeCm3, 2 / 3);
    const overhangSurfaceFraction = supportEnabled ? Math.min(1, Math.max(0, (surfaceToVolumeRatio - 6) / 12) * rates.supportSurfaceFractionFactor) : 0;
    const supportVolumeCm3 = validatedSurfaceAreaCm2 * overhangSurfaceFraction * (layerHeight / 10) * rates.supportVolumeFactor;
    const wasteVolumeCm3 = (depositedMaterialVolumeCm3 + supportVolumeCm3) * wasteFactorPercent / 100;
    const slicerResult = await FdmSlicerService.slice({ modelData: request.modelData, format: request.fileName?.split('.').pop() || 'stl', materialId: request.materialId.toLowerCase(), quantity: request.quantity, layerHeightMm: layerHeight, infillPercent, wallCount, printSpeedMmPerSecond: speed, supportEnabled });
    const geometryDrivenMaterialVolumeCm3 = depositedMaterialVolumeCm3 + supportVolumeCm3 + wasteVolumeCm3;
    const materialVolumeCm3 = Math.max(slicerResult.materialVolumeCm3, geometryDrivenMaterialVolumeCm3);
    const materialUsageGrams = materialVolumeCm3 * density;
    const materialCost = materialUsageGrams * materialPrice;
    const estimatedLayerCount = Math.max(1, Math.ceil(dimensions.height / Math.max(layerHeight, Number.EPSILON)));
    const layerCount = Math.max(slicerResult.layerCount, estimatedLayerCount);
    const extrusionSeconds = ((depositedMaterialVolumeCm3 + supportVolumeCm3) * 1000) / (lineWidth * layerHeight * speed) * (1 + travelOverheadPercent / 100);
    const layerOverheadSeconds = Math.max(0, layerCount) * perLayerOverheadSeconds;
    const estimatedMachineSeconds = extrusionSeconds + layerOverheadSeconds;
    const machineTimeSeconds = Math.max(slicerResult.printTimeSeconds, estimatedMachineSeconds);
    const machineTimeMinutes = machineTimeSeconds / 60;
    const machineCost = (machineTimeMinutes / 60) * rates.machineHourlyRateEgp;
    const setupTimeMinutes = rates.setupTimeMinutes;
    const finishKey = request.surfaceFinish.toLowerCase();
    const postProcessingCost = rates.postProcessingRatesEgp[finishKey] ?? (finishKey === 'standard' ? 0 : NaN);
    if (!Number.isFinite(postProcessingCost)) throw new Error(`No EGP post-processing price is configured for ${request.surfaceFinish}.`);

    // Prepare model variables context for the AST pricing engine
    const modelVariables = {
      width: dimensions.width,
      height: dimensions.height,
      depth: dimensions.depth,
      dimensionsMm: dimensions,
      volume: validatedVolumeCm3 * 1000,
      volumeCm3: validatedVolumeCm3,
      surfaceArea: validatedSurfaceAreaCm2 * 100,
      surfaceAreaCm2: validatedSurfaceAreaCm2,
      boundingBoxVolume: dimensions.width * dimensions.height * dimensions.depth,
      infill: infillPercent,
      infillPercent,
      layerHeight,
      shellThickness: wallCount * lineWidth,
      wallCount,
      quantity: request.quantity,
      density,
      machineTime: machineTimeMinutes / 60,
      machineTimeMinutes,
      materialPrice,
      material: request.materialId,
      technology: request.technology,
    };

    let evaluationResult;
    try {
      const { PricingAdminService } = await import('../../services/pricing-admin.service');
      const { PricingEngineService } = await import('../../services/pricing-engine.service');
      const activeEquation = await PricingAdminService.getActivePublishedEquation(request.technology);
      evaluationResult = PricingEngineService.calculatePricing({
        modelContext: modelVariables,
        customVariables: activeEquation.customVariables,
        constants: activeEquation.constants,
        equationTree: activeEquation.formulaTree,
        equationVersionId: activeEquation.version.id,
        equationVersion: activeEquation.version.version,
      });
    } catch (err: any) {
      Logger.warn(`[CAMLabsManufacturingEngine] Fallback to default equation template: ${err.message}`);
      const { PricingEngineService } = await import('../../services/pricing-engine.service');
      const { DEFAULT_FDM_TEMPLATE } = await import('../../services/pricing-admin.service');
      // The template's PLÁ/PLA_PRICE constant is the canonical PLA floor; pin it
      // to the exact material being quoted so the fallback never undercuts the
      // authoritative per-material rate (PLA 2 / ABS 3 / PETG 3 / TPU 4 EGP/g).
      const fallbackConstants = DEFAULT_FDM_TEMPLATE.constants.map((c) =>
        c.key === 'PLA_PRICE'
          ? { ...c, value: materialPrice }
          : c
      );
      evaluationResult = PricingEngineService.calculatePricing({
        modelContext: modelVariables,
        customVariables: DEFAULT_FDM_TEMPLATE.customVariables,
        constants: fallbackConstants,
        equationTree: DEFAULT_FDM_TEMPLATE.formulaTree,
        equationVersion: 1,
      });
    }

    const unitManufacturingCost = evaluationResult.unitPrice;
    const finalCustomerPrice = evaluationResult.totalPrice;

    const setupCost = (setupTimeMinutes / 60) * rates.laborHourlyRateEgp + rates.setupConsumablesEgp;
    const laborTimeMinutes = (rates.productionLaborMinutes + rates.postProcessingMinutes) * request.quantity;
    const laborCost = (laborTimeMinutes / 60) * rates.laborHourlyRateEgp;

    const breakdown = {
      geometry: { volumeCm3: validatedVolumeCm3, surfaceAreaCm2: validatedSurfaceAreaCm2, dimensionsMm: dimensions, boundingBoxHeightMm: dimensions.height, triangleCount: request.triangleCount, units: request.geometryUnits || 'mm' },
      manufacturing: { technology: 'FDM', material: request.materialId, layerHeightMm: layerHeight, infillPercent, wallCount, lineWidthMm: lineWidth, printSpeedMmPerSecond: speed, layerCount, quantity: request.quantity },
      material: { modelVolumeCm3: validatedVolumeCm3, depositedMaterialVolumeCm3, supportVolumeCm3, wasteVolumeCm3, materialVolumeCm3, materialUsageGrams, densityGramsPerCm3: density, pricePerGramEgp: materialPrice, cost: materialCost },
      machine: { printTimeMinutes: machineTimeMinutes, machineHourlyRateEgp: rates.machineHourlyRateEgp, cost: machineCost },
      labor: { setupTimeMinutes, productionTimeMinutes: rates.productionLaborMinutes, postProcessingTimeMinutes: rates.postProcessingMinutes, laborHourlyRateEgp: rates.laborHourlyRateEgp, cost: laborCost },
      additionalManufacturing: { setupConsumablesEgp: rates.setupConsumablesEgp, postProcessingCost },
      materialCost,
      machineCost,
      laborCost,
      setupCost,
      postProcessingCost,
      unitManufacturingCost,
      quantity: request.quantity,
      manufacturingCost: finalCustomerPrice,
      minimumOrderAdjustment: 0,
      finalCustomerPrice,
      currency: 'EGP' as const,
      materialUsageGrams,
      machineTimeMinutes,
      laborTimeMinutes,
      setupTimeMinutes,
      equationVersionId: evaluationResult.equationVersionId,
      equationVersion: evaluationResult.equationVersion,
      equationBreakdown: evaluationResult.breakdown,
      sources: { geometry: request.geometrySource || 'calculated' as const, materialUsage: 'actual' as const, machineTime: 'actual' as const, supportVolume: 'estimated' as const, pricingConfiguration: 'configured' as const },
    };

    return {
      engineName: 'CAM LABS',
      manufacturingBaseCost: unitManufacturingCost,
      manufacturingTotalCost: finalCustomerPrice,
      leadTimeDays: 2,
      leadTimeFormatted: '24 - 48 Hours',
      currency: 'EGP',
      discountAppliedPercentage: 0,
      quoteRef: `CAM-ENGINE-${Date.now()}`,
      dfmSummary: { isManufacturable: true, issues: [] },
      pricingBreakdown: breakdown,
    };
  }

  async dispatchOrder(dispatchData: ManufacturingOrderDispatch): Promise<ManufacturingDispatchResult> {
    const dispatchedAt = new Date();
    const leadDays = leadTimeDaysFor(dispatchData.technology);
    const estimatedCompletion = new Date(dispatchedAt.getTime() + leadDays * 24 * 60 * 60 * 1000);
    Logger.info(`[CAMLabsManufacturingEngine] Queuing internal order ${dispatchData.orderId} on ${INTERNAL_NODE} (${leadDays} day lead).`);
    return {
      engineName: 'CAM LABS',
      trackingId: `CAM-TRK-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      internalOrderRef: `CAM-ORD-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      dispatchedAt: dispatchedAt.toISOString(),
      status: 'Queued',
      estimatedCompletion: estimatedCompletion.toISOString().split('T')[0],
      telemetry: { node: INTERNAL_NODE, leadTimeDays: leadDays, provider: 'internal' },
    };
  }

  async getOrderStatus(trackingId: string) {
    try {
      const { getPrismaClient } = await import('../../config/database');
      const prisma = getPrismaClient();
      const order = await prisma.order.findFirst({
        where: { trackingNum: trackingId },
        include: { manufacturingRequests: true, events: { orderBy: { createdAt: 'desc' }, take: 10 } },
      });

      if (!order) {
        return {
          status: 'UNKNOWN',
          currentMilestone: 'Tracking ID not found',
          progressPercentage: 0,
          telemetry: { trackingId, node: INTERNAL_NODE },
        };
      }

      const milestone = order.manufacturingRequests?.[0]?.status || order.manufacturingStatus || 'PENDING';
      const progressMap: Record<string, number> = {
        PENDING: 10, ACCEPTED: 25, IN_PROGRESS: 55, QUALITY: 80, COMPLETED: 100, SHIPPED: 100, DELIVERED: 100,
      };
      const lastEvent = order.events?.[0];
      const milestones = (order.events || []).map((event) => ({
        eventType: event.eventType,
        description: event.description,
        at: event.createdAt.toISOString(),
      }));

      return {
        status: milestone,
        currentMilestone: lastEvent?.description || 'Queued in CAM LABS internal manufacturing',
        progressPercentage: progressMap[milestone] ?? 10,
        telemetry: { trackingId, orderId: order.id, node: INTERNAL_NODE, technology: order.technology, material: order.material, quantity: order.quantity },
        milestones,
      };
    } catch (error) {
      Logger.warn(`[CAMLabsManufacturingEngine] Status lookup failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 'Queued',
        currentMilestone: 'CAM LABS Internal Toolpath Scheduling',
        progressPercentage: 10,
        telemetry: { trackingId, node: INTERNAL_NODE },
      };
    }
  }
}