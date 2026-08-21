import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CAMLabsManufacturingEngine } from '../src/providers/manufacturing/CAMLabsManufacturingEngine';

const modelData = readFileSync(path.resolve(__dirname, '../../test-fixtures/tetrahedron.stl'));
const malformedModelData = readFileSync(path.resolve(__dirname, '../../test-fixtures/malformed.stl'));

describe('CAM LABS FDM engineering pricing engine', () => {
  const geometry = {
    volumeCm3: 12,
    surfaceAreaCm2: 30,
    dimensionsMm: { width: 30, depth: 20, height: 15 },
    triangleCount: 24,
  };

  it('calculates an explicit EGP breakdown from geometry and manufacturing inputs', async () => {
    const quote = await new CAMLabsManufacturingEngine().calculateQuote({
      materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 2, modelData, fileName: 'tetrahedron.stl', ...geometry,
      manufacturingParameters: { layerHeightMm: 0.2, infillPercent: 20, wallCount: 2, printSpeedMmPerSecond: 50 },
    });

    expect(quote.currency).toBe('EGP');
    expect(quote.pricingBreakdown?.materialCost).toBeGreaterThan(0);
    expect(quote.pricingBreakdown?.machineCost).toBeGreaterThan(0);
    expect(quote.pricingBreakdown?.setupCost).toBeGreaterThan(0);
    expect(quote.pricingBreakdown?.sources.materialUsage).toBe('actual');
    expect(quote.pricingBreakdown?.sources.machineTime).toBe('actual');
    expect(quote.manufacturingTotalCost).toBe(quote.pricingBreakdown?.finalCustomerPrice);
    expect(quote.pricingBreakdown?.quantity).toBe(2);
  });

  it('changes machine and material costs when manufacturing parameters change', async () => {
    const engine = new CAMLabsManufacturingEngine();
    const standard = await engine.calculateQuote({ materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1, modelData, fileName: 'tetrahedron.stl', ...geometry, manufacturingParameters: { infillPercent: 10, layerHeightMm: 0.3 } });
    const dense = await engine.calculateQuote({ materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1, modelData, fileName: 'tetrahedron.stl', ...geometry, manufacturingParameters: { infillPercent: 80, layerHeightMm: 0.1 } });

    expect(dense.pricingBreakdown!.manufacturing.layerCount).toBeGreaterThan(standard.pricingBreakdown!.manufacturing.layerCount);
    expect(dense.pricingBreakdown!.material.materialVolumeCm3).toBeGreaterThan(standard.pricingBreakdown!.material.materialVolumeCm3);
    expect(dense.pricingBreakdown!.machine.printTimeMinutes).toBeGreaterThan(standard.pricingBreakdown!.machine.printTimeMinutes);
  });

  it('uses the geometry-derived estimate when slicer output is flat for tiny parts', async () => {
    const engine = new CAMLabsManufacturingEngine();
    const light = await engine.calculateQuote({
      materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1,
      modelData, fileName: 'tetrahedron.stl', ...geometry,
      manufacturingParameters: { infillPercent: 0, wallCount: 1, layerHeightMm: 0.28 },
    });
    const dense = await engine.calculateQuote({
      materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1,
      modelData, fileName: 'tetrahedron.stl', ...geometry,
      manufacturingParameters: { infillPercent: 100, wallCount: 5, layerHeightMm: 0.1 },
    });

    expect(dense.pricingBreakdown!.material.materialVolumeCm3).toBeGreaterThan(light.pricingBreakdown!.material.materialVolumeCm3);
    expect(dense.pricingBreakdown!.machine.printTimeMinutes).toBeGreaterThan(light.pricingBreakdown!.machine.printTimeMinutes);
    expect(dense.manufacturingTotalCost).toBeGreaterThan(light.manufacturingTotalCost);
  });

  it('estimates support from surface-to-volume geometry when supports are enabled', async () => {
    const quote = await new CAMLabsManufacturingEngine().calculateQuote({
      materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1,
      modelData, fileName: 'tetrahedron.stl', ...geometry, surfaceAreaCm2: 100, manufacturingParameters: { supportEnabled: true },
    });

    expect(quote.pricingBreakdown!.material.supportVolumeCm3).toBeGreaterThan(0);
    expect(quote.pricingBreakdown!.sources.supportVolume).toBe('estimated');
  });

  it('uses the selected material density and configured EGP rate', async () => {
    const engine = new CAMLabsManufacturingEngine();
    const pla = await engine.calculateQuote({ materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1, modelData, fileName: 'tetrahedron.stl', ...geometry });
    const abs = await engine.calculateQuote({ materialId: 'abs', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1, modelData, fileName: 'tetrahedron.stl', ...geometry });

    expect(pla.pricingBreakdown!.material.pricePerGramEgp).not.toBe(abs.pricingBreakdown!.material.pricePerGramEgp);
    expect(pla.pricingBreakdown!.material.densityGramsPerCm3).not.toBe(abs.pricingBreakdown!.material.densityGramsPerCm3);
  });

  it('refuses unsupported or unanalyzable manufacturing inputs', async () => {
    const engine = new CAMLabsManufacturingEngine();
    await expect(engine.calculateQuote({ materialId: 'pla', technology: 'SLA', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1, modelData, fileName: 'tetrahedron.stl', ...geometry })).rejects.toThrow('not supported');
    await expect(engine.calculateQuote({ materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1 })).rejects.toThrow('geometry');
    await expect(engine.calculateQuote({ materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1, modelData, fileName: 'tetrahedron.stl', ...geometry, manufacturingParameters: { layerHeightMm: 2 } })).rejects.toThrow('Layer height');
    await expect(engine.calculateQuote({ materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1, ...geometry })).rejects.toThrow('slicer input');
    await expect(engine.calculateQuote({ materialId: 'pla', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1, modelData: malformedModelData, fileName: 'malformed.stl', ...geometry })).rejects.toThrow('slicer calculation failed');
  });
});
