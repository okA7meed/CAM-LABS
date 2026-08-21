/**
 * Pricing Configuration Service
 *
 * Centralizes manufacturing pricing rules, material cost multipliers,
 * and technology-specific pricing adjustments for CAM LABS.
 *
 * Used by PricingService to apply consistent business rules across
 * all quotation calculations.
 */

export interface ManufacturingPricingConfiguration {
  materialPriceEgpPerGram: Record<string, number>;
  materialDensityGramsPerCm3: Record<string, number>;
  machineHourlyRateEgp: number;
  laborHourlyRateEgp: number;
  setupTimeMinutes: number;
  productionLaborMinutes: number;
  postProcessingMinutes: number;
  postProcessingRatesEgp: Record<string, number>;
  setupConsumablesEgp: number;
  minimumOrderPriceEgp: number;
  wasteFactorPercent: number;
  supportSurfaceFractionFactor: number;
  supportVolumeFactor: number;
  defaultLayerHeightMm: number;
  defaultInfillPercent: number;
  defaultWallCount: number;
  defaultLineWidthMm: number;
  defaultPrintSpeedMmPerSecond: number;
  perLayerOverheadSeconds: number;
  travelOverheadPercent: number;
}

const numberSetting = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  if (Number.isFinite(value) && value >= 0) return value;
  return process.env.NODE_ENV === 'production' ? Number.NaN : fallback;
};

export const MANUFACTURING_PRICING_CONFIGURATION: ManufacturingPricingConfiguration = {
  materialPriceEgpPerGram: {
    pla: numberSetting('CAM_LABS_FDM_PLA_EGP_PER_GRAM', 12),
    abs: numberSetting('CAM_LABS_FDM_ABS_EGP_PER_GRAM', 15),
    petg: numberSetting('CAM_LABS_FDM_PETG_EGP_PER_GRAM', 15),
    tpu: numberSetting('CAM_LABS_FDM_TPU_EGP_PER_GRAM', 24),
  },
  materialDensityGramsPerCm3: {
    pla: numberSetting('CAM_LABS_FDM_PLA_DENSITY_G_PER_CM3', 1.24),
    abs: numberSetting('CAM_LABS_FDM_ABS_DENSITY_G_PER_CM3', 1.04),
    petg: numberSetting('CAM_LABS_FDM_PETG_DENSITY_G_PER_CM3', 1.27),
    tpu: numberSetting('CAM_LABS_FDM_TPU_DENSITY_G_PER_CM3', 1.21),
  },
  machineHourlyRateEgp: numberSetting('CAM_LABS_MACHINE_RATE_EGP_PER_HOUR', 180),
  laborHourlyRateEgp: numberSetting('CAM_LABS_LABOR_RATE_EGP_PER_HOUR', 120),
  setupTimeMinutes: numberSetting('CAM_LABS_SETUP_TIME_MINUTES', 10),
  productionLaborMinutes: numberSetting('CAM_LABS_PRODUCTION_LABOR_MINUTES', 8),
  postProcessingMinutes: numberSetting('CAM_LABS_POST_PROCESSING_MINUTES', 0),
  postProcessingRatesEgp: { standard: numberSetting('CAM_LABS_POST_PROCESSING_STANDARD_EGP', 0), smooth: numberSetting('CAM_LABS_POST_PROCESSING_SMOOTH_EGP', 0) },
  setupConsumablesEgp: numberSetting('CAM_LABS_SETUP_CONSUMABLES_EGP', 0),
  minimumOrderPriceEgp: numberSetting('CAM_LABS_MINIMUM_ORDER_EGP', 0),
  wasteFactorPercent: numberSetting('CAM_LABS_WASTE_FACTOR_PERCENT', 8),
  supportSurfaceFractionFactor: numberSetting('CAM_LABS_SUPPORT_SURFACE_FRACTION_FACTOR', 1),
  supportVolumeFactor: numberSetting('CAM_LABS_SUPPORT_VOLUME_FACTOR', 0.35),
  defaultLayerHeightMm: numberSetting('CAM_LABS_FDM_DEFAULT_LAYER_HEIGHT_MM', 0.2),
  defaultInfillPercent: numberSetting('CAM_LABS_FDM_DEFAULT_INFILL_PERCENT', 20),
  defaultWallCount: numberSetting('CAM_LABS_FDM_DEFAULT_WALL_COUNT', 2),
  defaultLineWidthMm: numberSetting('CAM_LABS_FDM_DEFAULT_LINE_WIDTH_MM', 0.45),
  defaultPrintSpeedMmPerSecond: numberSetting('CAM_LABS_FDM_DEFAULT_PRINT_SPEED_MM_S', 50),
  perLayerOverheadSeconds: numberSetting('CAM_LABS_FDM_PER_LAYER_OVERHEAD_SECONDS', 0.04),
  travelOverheadPercent: numberSetting('CAM_LABS_FDM_TRAVEL_OVERHEAD_PERCENT', 15),
};

