import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  cadFindFirst: vi.fn(),
  calculateQuote: vi.fn(),
  storageRead: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  getPrismaClient: () => ({
    cadFile: { findFirst: state.cadFindFirst },
  }),
}));

vi.mock('../src/cad/object-storage', () => ({
  createObjectStorage: () => ({ read: state.storageRead }),
}));

vi.mock('../src/providers/manufacturing', () => ({
  getManufacturingEngine: () => ({ calculateQuote: state.calculateQuote }),
}));

import { QuotesService } from '../src/services/quotes.service';

const readyCadFile = (overrides: Record<string, unknown> = {}) => ({
  id: 'file-a',
  userId: 'user-a',
  guestId: null,
  versions: [{
    storageKey: 'user-a/file-a.stl',
    processingStatus: 'COMPLETE',
    detectedUnit: 'mm',
    metadata: { geometryStatus: 'READY', supportLevel: 'FULLY_SUPPORTED', volume: 1000, surfaceArea: 600, dimensions: { width: 10, height: 10, depth: 10 }, triangleCount: 12 },
    ...overrides,
  }],
});

const manufacturingQuote = {
  engineName: 'CAM LABS',
  manufacturingBaseCost: 10,
  manufacturingTotalCost: 10,
  leadTimeDays: 2,
  leadTimeFormatted: '2 Days',
  currency: 'EGP',
  discountAppliedPercentage: 0,
  quoteRef: 'CAM-QUOTE-1',
  pricingBreakdown: {
    geometry: { volumeCm3: 1, surfaceAreaCm2: 6, dimensionsMm: { width: 10, depth: 10, height: 10 }, boundingBoxHeightMm: 10, units: 'mm' },
    manufacturing: { technology: 'FDM', material: 'pla', layerHeightMm: 0.2, infillPercent: 15, wallCount: 3, lineWidthMm: 0.45, printSpeedMmPerSecond: 50, layerCount: 50, quantity: 1 },
    material: { modelVolumeCm3: 1, depositedMaterialVolumeCm3: 0.2, supportVolumeCm3: 0, wasteVolumeCm3: 0, materialVolumeCm3: 0.2, materialUsageGrams: 0.25, densityGramsPerCm3: 1.24, pricePerGramEgp: 12, cost: 3 },
    machine: { printTimeMinutes: 10, machineHourlyRateEgp: 180, cost: 3 },
    labor: { setupTimeMinutes: 10, productionTimeMinutes: 5, postProcessingTimeMinutes: 0, laborHourlyRateEgp: 120, cost: 4 },
    additionalManufacturing: { setupConsumablesEgp: 0, postProcessingCost: 0 },
    materialCost: 3,
    machineCost: 3,
    laborCost: 4,
    setupCost: 5,
    postProcessingCost: 0,
    unitManufacturingCost: 10,
    quantity: 1,
    manufacturingCost: 10,
    minimumOrderAdjustment: 0,
    finalCustomerPrice: 10,
    currency: 'EGP',
    materialUsageGrams: 0.25,
    machineTimeMinutes: 10,
    laborTimeMinutes: 5,
    setupTimeMinutes: 10,
    sources: { geometry: 'calculated', materialUsage: 'estimated', machineTime: 'estimated', supportVolume: 'estimated', pricingConfiguration: 'configured' },
  },
};

describe('upload quote trust boundary', () => {
  beforeEach(() => {
    state.cadFindFirst.mockReset();
    state.cadFindFirst.mockResolvedValue(readyCadFile());
    state.calculateQuote.mockReset();
    state.calculateQuote.mockResolvedValue(manufacturingQuote);
    state.storageRead.mockReset();
    state.storageRead.mockResolvedValue(Buffer.from('model'));
  });

  it('calculates quotes only after owner-scoped ready CAD analysis', async () => {
    const quote = await QuotesService.calculateMultiFileQuotation({
      cadOwner: { userId: 'user-a' },
      files: [{ fileId: 'file-a', fileName: 'part.stl', format: 'STL', materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1 }],
    });

    expect(quote.files).toHaveLength(1);
    expect(state.cadFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'file-a', userId: 'user-a' }) }));
    expect(state.calculateQuote).toHaveBeenCalledOnce();
  });

  it.each([
    ['wrong owner', null],
    ['processing', readyCadFile({ processingStatus: 'PROCESSING' })],
    ['failed', readyCadFile({ processingStatus: 'FAILED', metadata: { geometryStatus: 'UNAVAILABLE', supportLevel: 'FAILED_VALIDATION' } })],
    ['missing metadata', readyCadFile({ metadata: null })],
  ])('rejects %s CAD before pricing', async (_label, cadFile) => {
    state.cadFindFirst.mockResolvedValue(cadFile);
    await expect(QuotesService.calculateMultiFileQuotation({
      cadOwner: { userId: 'user-a' },
      files: [{ fileId: 'file-a', fileName: 'part.stl', format: 'STL', materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1 }],
    })).rejects.toThrow('Engineering analysis is unavailable');
    expect(state.calculateQuote).not.toHaveBeenCalled();
  });
});