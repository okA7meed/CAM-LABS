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
    const machineCost = machineTimeMinutes / 60 * MANUFACTURING_PRICING_CONFIGURATION.machineHourlyRateEgp;
    const setupTimeMinutes = MANUFACTURING_PRICING_CONFIGURATION.setupTimeMinutes;
    const finishKey = request.surfaceFinish.toLowerCase();
    const postProcessingCost = MANUFACTURING_PRICING_CONFIGURATION.postProcessingRatesEgp[finishKey] ?? (finishKey === 'standard' ? 0 : NaN);
    if (!Number.isFinite(postProcessingCost)) throw new Error(`No EGP post-processing price is configured for ${request.surfaceFinish}.`);
    const laborTimeMinutes = (productionLaborMinutes + postProcessingMinutes) * request.quantity;
    const laborCost = laborTimeMinutes / 60 * MANUFACTURING_PRICING_CONFIGURATION.laborHourlyRateEgp;
    const setupConsumablesEgp = MANUFACTURING_PRICING_CONFIGURATION.setupConsumablesEgp;
    const setupCost = setupTimeMinutes / 60 * MANUFACTURING_PRICING_CONFIGURATION.laborHourlyRateEgp + setupConsumablesEgp;
    const unitManufacturingCost = (materialCost + machineCost + laborCost) / request.quantity + postProcessingCost;
    const manufacturingCost = setupCost + materialCost + machineCost + laborCost + postProcessingCost * request.quantity;
    const minimumOrderAdjustment = Math.max(0, MANUFACTURING_PRICING_CONFIGURATION.minimumOrderPriceEgp - manufacturingCost);
    const finalCustomerPrice = manufacturingCost + minimumOrderAdjustment;
    const breakdown = {
      geometry: { volumeCm3: validatedVolumeCm3, surfaceAreaCm2: validatedSurfaceAreaCm2, dimensionsMm: dimensions, boundingBoxHeightMm: dimensions.height, triangleCount: request.triangleCount, units: request.geometryUnits || 'mm' },
      manufacturing: { technology: 'FDM', material: request.materialId, layerHeightMm: layerHeight, infillPercent, wallCount, lineWidthMm: lineWidth, printSpeedMmPerSecond: speed, layerCount, quantity: request.quantity },
      material: { modelVolumeCm3: validatedVolumeCm3, depositedMaterialVolumeCm3, supportVolumeCm3, wasteVolumeCm3, materialVolumeCm3, materialUsageGrams, densityGramsPerCm3: density, pricePerGramEgp: materialPrice, cost: materialCost },
      machine: { printTimeMinutes: machineTimeMinutes, machineHourlyRateEgp: rates.machineHourlyRateEgp, cost: machineCost },
      labor: { setupTimeMinutes, productionTimeMinutes: productionLaborMinutes, postProcessingTimeMinutes: postProcessingMinutes, laborHourlyRateEgp: rates.laborHourlyRateEgp, cost: laborCost },
      additionalManufacturing: { setupConsumablesEgp, postProcessingCost },
      materialCost, machineCost, laborCost, setupCost, postProcessingCost, unitManufacturingCost, quantity: request.quantity, manufacturingCost, minimumOrderAdjustment, finalCustomerPrice, currency: 'EGP' as const, materialUsageGrams, machineTimeMinutes, laborTimeMinutes, setupTimeMinutes,
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
    Logger.info(`[CAMLabsManufacturingEngine] Queuing internal order ${dispatchData.orderId}.`);
    return {
      engineName: 'CAM LABS',
      trackingId: `CAM-TRK-${Date.now()}`,
      internalOrderRef: `CAM-ORD-${Date.now()}`,
      dispatchedAt: new Date().toISOString(),
      status: 'Queued',
      estimatedCompletion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
  }

  async getOrderStatus(trackingId: string) {
    return {
      status: 'Queued',
      currentMilestone: 'CAM LABS Internal Toolpath Scheduling',
      progressPercentage: 10,
      telemetry: { trackingId, node: 'CAM-LABS-INTERNAL-CELL-01' },
    };
  }
}