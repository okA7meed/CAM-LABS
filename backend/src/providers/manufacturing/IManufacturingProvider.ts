export interface ManufacturingQuoteRequest {
  materialId: string;
  technology: string;
  surfaceFinish: string;
  toleranceGrade: 'standard' | 'precision';
  quantity: number;
  volumeCm3?: number;
  surfaceAreaCm2?: number;
  dimensionsMm?: { width: number; depth: number; height: number };
  triangleCount?: number;
  geometrySource?: 'actual' | 'simulated' | 'estimated' | 'calculated';
  geometryUnits?: string;
  modelData?: Buffer;
  manufacturingParameters?: {
    layerHeightMm?: number;
    infillPercent?: number;
    wallCount?: number;
    lineWidthMm?: number;
    printSpeedMmPerSecond?: number;
    supportEnabled?: boolean;
    wasteFactorPercent?: number;
    perLayerOverheadSeconds?: number;
    travelOverheadPercent?: number;
    productionLaborMinutes?: number;
    postProcessingMinutes?: number;
  };
  fileName?: string;
  cadFileUrl?: string;
}

export interface ManufacturingQuoteResponse {
  engineName: 'CAM LABS';
  manufacturingBaseCost: number;
  manufacturingTotalCost: number;
  leadTimeDays: number;
  leadTimeFormatted: string;
  currency: 'EGP';
  discountAppliedPercentage: number;
  quoteRef?: string;
  dfmSummary?: {
    isManufacturable: boolean;
    issues?: string[];
    suggestedModifications?: string[];
  };
  pricingBreakdown?: PricingBreakdown;
}

export type ManufacturingValueSource = 'actual' | 'simulated' | 'estimated' | 'calculated' | 'configured';

export interface PricingBreakdown {
  geometry: {
    volumeCm3: number;
    surfaceAreaCm2: number;
    dimensionsMm: { width: number; depth: number; height: number };
    boundingBoxHeightMm: number;
    triangleCount?: number;
    units: string;
  };
  manufacturing: {
    technology: string;
    material: string;
    layerHeightMm: number;
    infillPercent: number;
    wallCount: number;
    lineWidthMm: number;
    printSpeedMmPerSecond: number;
    layerCount: number;
    quantity: number;
  };
  material: {
    modelVolumeCm3: number;
    depositedMaterialVolumeCm3: number;
    supportVolumeCm3: number;
    wasteVolumeCm3: number;
    materialVolumeCm3: number;
    materialUsageGrams: number;
    densityGramsPerCm3: number;
    pricePerGramEgp: number;
    cost: number;
  };
  machine: {
    printTimeMinutes: number;
    machineHourlyRateEgp: number;
    cost: number;
  };
  labor: {
    setupTimeMinutes: number;
    productionTimeMinutes: number;
    postProcessingTimeMinutes: number;
    laborHourlyRateEgp: number;
    cost: number;
  };
  additionalManufacturing: {
    setupConsumablesEgp: number;
    postProcessingCost: number;
  };
  materialCost: number;
  machineCost: number;
  laborCost: number;
  setupCost: number;
  postProcessingCost: number;
  unitManufacturingCost: number;
  quantity: number;
  manufacturingCost: number;
  minimumOrderAdjustment: number;
  finalCustomerPrice: number;
  currency: 'EGP';
  materialUsageGrams: number;
  machineTimeMinutes: number;
  laborTimeMinutes: number;
  setupTimeMinutes: number;
  sources: {
    geometry: ManufacturingValueSource;
    materialUsage: ManufacturingValueSource;
    machineTime: ManufacturingValueSource;
    supportVolume: ManufacturingValueSource;
    pricingConfiguration: ManufacturingValueSource;
  };
}

/**
 * Order dispatch payload sent to the CAM LABS manufacturing engine.
 */
export interface ManufacturingOrderDispatch {
  orderId: string;
  quoteId?: string;
  cadFileUrl?: string;
  technology: string;
  material: string;
  quantity: number;
  tolerance: string;
  surfaceFinish: string;
  shippingAddress: string;
  customerNotes?: string;
}

export interface ManufacturingDispatchResult {
  engineName: 'CAM LABS';
  trackingId: string;
  dispatchedAt: string;
  status: 'Queued' | 'Dispatched' | 'In Production';
  estimatedCompletion: string;
  internalOrderRef: string;
}

export interface IManufacturingEngine {
  readonly name: 'CAM LABS';
  calculateQuote(request: ManufacturingQuoteRequest): Promise<ManufacturingQuoteResponse>;
  dispatchOrder(dispatchData: ManufacturingOrderDispatch): Promise<ManufacturingDispatchResult>;
  getOrderStatus(trackingId: string): Promise<{
    status: string;
    currentMilestone: string;
    progressPercentage: number;
    telemetry: Record<string, unknown>;
  }>;
}
