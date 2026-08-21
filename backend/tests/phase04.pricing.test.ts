import { describe, expect, it } from 'vitest';
import { PricingService } from '../src/services/pricing.service';
import { ManufacturingQuoteResponse } from '../src/providers/manufacturing/IManufacturingProvider';

const camLabsQuote = (total: number, unit = total): ManufacturingQuoteResponse => ({
  engineName: 'CAM LABS',
  manufacturingBaseCost: unit,
  manufacturingTotalCost: total,
  leadTimeDays: 3,
  leadTimeFormatted: '3 Days',
  currency: 'EGP',
  discountAppliedPercentage: 0,
  quoteRef: 'CAM-TEST-1',
  pricingBreakdown: {
    geometry: { volumeCm3: 10, surfaceAreaCm2: 20, dimensionsMm: { width: 10, depth: 10, height: 10 }, boundingBoxHeightMm: 10, units: 'mm' },
    manufacturing: { technology: 'FDM', material: 'pla', layerHeightMm: 0.2, infillPercent: 20, wallCount: 2, lineWidthMm: 0.45, printSpeedMmPerSecond: 50, layerCount: 50, quantity: 1 },
    material: { modelVolumeCm3: 10, depositedMaterialVolumeCm3: 2, supportVolumeCm3: 0, wasteVolumeCm3: 0.1, materialVolumeCm3: 2.1, materialUsageGrams: 2.6, densityGramsPerCm3: 1.24, pricePerGramEgp: 12, cost: unit / 3 },
    machine: { printTimeMinutes: 10, machineHourlyRateEgp: 180, cost: unit / 3 },
    labor: { setupTimeMinutes: 10, productionTimeMinutes: 8, postProcessingTimeMinutes: 0, laborHourlyRateEgp: 120, cost: unit / 3 },
    additionalManufacturing: { setupConsumablesEgp: 0, postProcessingCost: 0 },
    materialCost: unit / 3, machineCost: unit / 3, laborCost: unit / 3, setupCost: 5, postProcessingCost: 0, unitManufacturingCost: unit, quantity: 1, manufacturingCost: total, minimumOrderAdjustment: 0, finalCustomerPrice: total, currency: 'EGP', materialUsageGrams: 2.6, machineTimeMinutes: 10, laborTimeMinutes: 8, setupTimeMinutes: 10,
    sources: { geometry: 'calculated', materialUsage: 'estimated', machineTime: 'estimated', supportVolume: 'estimated', pricingConfiguration: 'configured' },
  },
});

describe('Phase 04 pricing authority', () => {
  it('uses the CAM LABS manufacturing price as the final customer price', () => {
    const quote = PricingService.processManufacturingQuote(camLabsQuote(100, 20), 5);

    expect(quote.manufacturingCostTotal).toBe(100);
    expect(quote.totalCustomerPrice).toBe(100);
    expect(quote.customerUnitPrice).toBe(20);
    expect(quote.currency).toBe('EGP');
    expect(quote.formattedTotalPrice).toBe('100.00 EGP');
  });

  it('aggregates multiple files using CAM LABS manufacturing rules', () => {
    const quote = PricingService.calculateMultiFileQuotation(
      [
        { fileId: 'a', fileName: 'a.stl', format: 'STL', materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 2, volumeCm3: 10 },
        { fileId: 'b', fileName: 'b.stl', format: 'STL', materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1, volumeCm3: 10 },
      ],
      [camLabsQuote(20, 10), camLabsQuote(10, 10)]
    );

    expect(quote.manufacturingSubtotal).toBeGreaterThan(0);
    expect(quote.totalCustomerPrice).toBe(quote.manufacturingSubtotal);
    expect(quote.files).toHaveLength(2);
    expect(quote.setupCost).toBe(5);
  });

  it('rejects invalid CAM LABS pricing values', () => {
    expect(() => PricingService.processManufacturingQuote(camLabsQuote(Number.NaN), 1)).toThrow('invalid pricing');
  });
});