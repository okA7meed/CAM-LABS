import { describe, expect, it, beforeAll } from 'vitest';
import { PricingAdminService } from '../src/services/pricing-admin.service';
import { PricingEngineService } from '../src/services/pricing-engine.service';
import { AstNode, ModelVariablesContext } from '../src/services/pricing-ast.types';

describe('Pricing Admin & Equation Lifecycle Integration', () => {
  beforeAll(async () => {
    await PricingAdminService.ensureInitialized();
  });

  it('initializes equations across all technologies', async () => {
    const equations = await PricingAdminService.getAllEquations();
    expect(equations.length).toBeGreaterThanOrEqual(6);

    const fdm = equations.find((e) => e.technology === 'FDM');
    expect(fdm).toBeDefined();
    expect(fdm?.currentPublishedVersion).toBeDefined();
    expect(fdm?.currentPublishedVersion?.version).toBe(1);
    expect(fdm?.draftVersion).toBeDefined();
  });

  it('retrieves FDM equation details with authoritative constants', async () => {
    const details = await PricingAdminService.getEquationByTechnology('FDM');
    expect(details.equation.technology).toBe('FDM');
    expect(details.publishedVersion).toBeDefined();
    expect(details.draftVersion).toBeDefined();

    const plaConst = details.constants.find((c) => c.key === 'PLA_PRICE');
    expect(plaConst).toBeDefined();
    expect(plaConst?.value).toBe(2);
    expect(plaConst?.unit).toBe('EGP/g');

    const machineConst = details.constants.find((c) => c.key === 'MACHINE_HOURLY_RATE');
    expect(machineConst).toBeDefined();
    expect(machineConst?.value).toBe(50);
    expect(machineConst?.unit).toBe('EGP/hour');

    const profitConst = details.constants.find((c) => c.key === 'PROFIT_MARGIN');
    expect(profitConst).toBeDefined();
    expect(profitConst?.value).toBe(0.20);
  });

  it('tests calculation against FDM geometry', async () => {
    const modelContext: ModelVariablesContext = {
      width: 20,
      height: 20,
      depth: 20,
      volumeCm3: 10,
      boundingBoxVolume: 8000,
      surfaceAreaCm2: 24,
      infill: 20,
      layerHeight: 0.2,
      shellThickness: 0.9,
      quantity: 1,
      density: 1.24,
      machineTimeHours: 0.5,
    };

    const result = await PricingAdminService.testEquation({
      technology: 'FDM',
      isDraft: false,
      modelContext,
    });

    expect(result.totalPrice).toBeGreaterThan(0);
    expect(result.currency).toBe('EGP');
    expect(result.breakdown.materialCost).toBeGreaterThan(0);
    expect(result.breakdown.machineCost).toBeGreaterThan(0);
  });

  it('compares draft equation with custom rate vs published equation', async () => {
    const modelContext: ModelVariablesContext = {
      width: 20,
      height: 20,
      depth: 20,
      volumeCm3: 10,
      boundingBoxVolume: 8000,
      surfaceAreaCm2: 24,
      infill: 20,
      layerHeight: 0.2,
      shellThickness: 0.9,
      quantity: 1,
      density: 1.24,
      machineTimeHours: 1.0,
    };

    // Custom draft formula with markup
    const draftTree: AstNode = {
      type: 'BINARY_OP',
      operator: '*',
      left: { type: 'VARIABLE', name: 'BaseCost' },
      right: { type: 'LITERAL', value: 1.5, unit: 'percentage' },
    };

    const comparison = await PricingAdminService.compareDraftVsPublished({
      technology: 'FDM',
      modelContext,
      draftFormulaOverride: draftTree,
    });

    expect(comparison.previousPrice).toBeGreaterThan(0);
    expect(comparison.newPrice).toBeGreaterThan(0);
    expect(comparison.currency).toBe('EGP');
    expect(typeof comparison.differenceEgp).toBe('number');
  });

  it('publishes draft as new immutable version and maintains version history', async () => {
    const publishedBefore = await PricingAdminService.getActivePublishedEquation('FDM');
    const oldVersion = publishedBefore.version.version;

    const publishResult = await PricingAdminService.publishDraft({
      technology: 'FDM',
      publishedBy: 'test-admin@camlabs.io',
      notes: 'Test publishing release v' + (oldVersion + 1),
    });

    expect(publishResult.publishedVersion.version).toBeGreaterThan(oldVersion);
    expect(publishResult.publishedVersion.status).toBe('PUBLISHED');

    const publishedAfter = await PricingAdminService.getActivePublishedEquation('FDM');
    expect(publishedAfter.version.version).toBe(publishResult.publishedVersion.version);
    expect(publishedAfter.version.publishedBy).toBe('test-admin@camlabs.io');
  });
});
