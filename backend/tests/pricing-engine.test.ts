import { describe, expect, it } from 'vitest';
import { PricingEngineService, UnitAlgebra } from '../src/services/pricing-engine.service';
import {
  AstNode,
  CustomVariableDefinition,
  PricingConstantDefinition,
  ModelVariablesContext,
} from '../src/services/pricing-ast.types';

describe('Authoritative Pricing Engine & AST Evaluator', () => {
  // Test 1: Constant resolution (PLA Price = 2 EGP/g)
  it('Test 1 — Constant: resolves PLA Price = 2 EGP/g correctly', () => {
    const constants: PricingConstantDefinition[] = [
      { key: 'PLA_PRICE', name: 'PLA Material Price', value: 2, unit: 'EGP/g' },
    ];
    const node: AstNode = { type: 'CONSTANT', name: 'PLA_PRICE' };
    const evalConstants = PricingEngineService.buildConstantsContext(constants);
    const result = PricingEngineService.evaluateAst(node, {}, evalConstants);

    expect(result.value).toBe(2);
    expect(result.unit).toBe('EGP/g');
  });

  // Test 2: Machine Rate resolution (Machine Hourly Rate = 50 EGP/hour)
  it('Test 2 — Machine Rate: resolves Machine Hourly Rate = 50 EGP/hour correctly', () => {
    const constants: PricingConstantDefinition[] = [
      { key: 'MACHINE_HOURLY_RATE', name: 'Machine Hourly Rate', value: 50, unit: 'EGP/hour' },
    ];
    const node: AstNode = { type: 'CONSTANT', name: 'MACHINE_HOURLY_RATE' };
    const evalConstants = PricingEngineService.buildConstantsContext(constants);
    const result = PricingEngineService.evaluateAst(node, {}, evalConstants);

    expect(result.value).toBe(50);
    expect(result.unit).toBe('EGP/hour');
  });

  // Test 3: Profit Margin (Profit Margin = 20%)
  it('Test 3 — Profit Margin: resolves Profit Margin = 20% correctly', () => {
    const constants: PricingConstantDefinition[] = [
      { key: 'PROFIT_MARGIN', name: 'Profit Margin', value: 0.20, unit: 'percentage' },
    ];
    const node: AstNode = { type: 'CONSTANT', name: 'PROFIT_MARGIN' };
    const evalConstants = PricingEngineService.buildConstantsContext(constants);
    const result = PricingEngineService.evaluateAst(node, {}, evalConstants);

    expect(result.value).toBe(0.20);
    expect(result.unit).toBe('percentage');
  });

  // Test 4: Custom Variable reuse (Weight = Density * Volume)
  it('Test 4 — Custom Variable: allows Weight = Density * Volume to be reused in another equation', () => {
    const customVariables: CustomVariableDefinition[] = [
      {
        code: 'Weight',
        name: 'Weight',
        unit: 'g',
        dataType: 'number',
        formulaTree: {
          type: 'BINARY_OP',
          operator: '*',
          left: { type: 'VARIABLE', name: 'Density' },
          right: { type: 'VARIABLE', name: 'Volume' },
        },
        dependencies: ['Density', 'Volume'],
        isEnabled: true,
      },
    ];

    const modelContext: ModelVariablesContext = {
      width: 10,
      height: 10,
      depth: 10,
      volume: 10000, // 10 cm3
      volumeCm3: 10,
      boundingBoxVolume: 10000,
      surfaceArea: 600,
      infill: 0.20,
      layerHeight: 0.2,
      shellThickness: 0.9,
      quantity: 1,
      density: 1.24, // g/cm3 -> Weight = 1.24 * 10 = 12.4g
    };

    const equationTree: AstNode = {
      type: 'BINARY_OP',
      operator: '*',
      left: { type: 'VARIABLE', name: 'Weight' },
      right: { type: 'LITERAL', value: 2, unit: 'EGP/g' },
    };

    const result = PricingEngineService.calculatePricing({
      modelContext,
      customVariables,
      constants: [],
      equationTree,
    });

    expect(result.breakdown.customVariablesEvaluated.Weight).toBeDefined();
    expect(result.breakdown.customVariablesEvaluated.Weight.value).toBeCloseTo(12.4, 2);
    expect(result.unitPrice).toBeCloseTo(24.8, 2);
  });

  // Test 5: Mathematical Operation (Weight * PLA Price)
  it('Test 5 — Mathematical Operation: Weight * PLA Price produces exact EGP result', () => {
    const customVariables: CustomVariableDefinition[] = [
      {
        code: 'Weight',
        name: 'Weight',
        unit: 'g',
        dataType: 'number',
        formulaTree: {
          type: 'BINARY_OP',
          operator: '*',
          left: { type: 'VARIABLE', name: 'Density' },
          right: { type: 'VARIABLE', name: 'Volume' },
        },
        dependencies: ['Density', 'Volume'],
        isEnabled: true,
      },
    ];

    const constants: PricingConstantDefinition[] = [
      { key: 'PLA_PRICE', name: 'PLA Price', value: 2, unit: 'EGP/g' },
    ];

    const modelContext: ModelVariablesContext = {
      width: 20,
      height: 20,
      depth: 20,
      volumeCm3: 50, // 50 cm3
      volume: 50000,
      boundingBoxVolume: 80000,
      surfaceArea: 2400,
      infill: 0.20,
      layerHeight: 0.2,
      shellThickness: 0.9,
      quantity: 1,
      density: 1.25, // Weight = 50 * 1.25 = 62.5g
    };

    // Weight (62.5g) * PLA_PRICE (2 EGP/g) = 125 EGP
    const equationTree: AstNode = {
      type: 'BINARY_OP',
      operator: '*',
      left: { type: 'VARIABLE', name: 'Weight' },
      right: { type: 'CONSTANT', name: 'PLA_PRICE' },
    };

    const result = PricingEngineService.calculatePricing({
      modelContext,
      customVariables,
      constants,
      equationTree,
    });

    expect(result.unitPrice).toBe(125);
    expect(result.currency).toBe('EGP');
  });

  // Test 6: Machine Cost (Machine Time * Machine Hourly Rate)
  it('Test 6 — Machine Cost: Machine Time * Machine Hourly Rate produces exact EGP result', () => {
    const constants: PricingConstantDefinition[] = [
      { key: 'MACHINE_HOURLY_RATE', name: 'Machine Hourly Rate', value: 50, unit: 'EGP/hour' },
    ];

    const modelContext: ModelVariablesContext = {
      width: 10,
      height: 10,
      depth: 10,
      volume: 1000,
      boundingBoxVolume: 1000,
      surfaceArea: 600,
      infill: 0.20,
      layerHeight: 0.2,
      shellThickness: 0.9,
      quantity: 1,
      machineTimeHours: 1.5, // 1.5 hours * 50 EGP/hour = 75 EGP
    };

    const equationTree: AstNode = {
      type: 'BINARY_OP',
      operator: '*',
      left: { type: 'VARIABLE', name: 'MachineTime' },
      right: { type: 'CONSTANT', name: 'MACHINE_HOURLY_RATE' },
    };

    const result = PricingEngineService.calculatePricing({
      modelContext,
      customVariables: [],
      constants,
      equationTree,
    });

    expect(result.unitPrice).toBe(75);
    expect(result.currency).toBe('EGP');
  });

  // Test 7: IF Condition
  it('Test 7 — IF Condition: IF Weight > 500g -> Weight * 1.5 ELSE Weight * 2', () => {
    const customVariables: CustomVariableDefinition[] = [
      {
        code: 'Weight',
        name: 'Weight',
        unit: 'g',
        dataType: 'number',
        formulaTree: {
          type: 'BINARY_OP',
          operator: '*',
          left: { type: 'VARIABLE', name: 'Density' },
          right: { type: 'VARIABLE', name: 'Volume' },
        },
        dependencies: ['Density', 'Volume'],
        isEnabled: true,
      },
    ];

    const equationTree: AstNode = {
      type: 'IF_ELSE',
      condition: {
        type: 'CONDITION',
        operator: '>',
        left: { type: 'VARIABLE', name: 'Weight' },
        right: { type: 'LITERAL', value: 500, unit: 'g' },
      },
      thenBranch: {
        type: 'BINARY_OP',
        operator: '*',
        left: { type: 'VARIABLE', name: 'Weight' },
        right: { type: 'LITERAL', value: 1.5, unit: 'EGP/g' },
      },
      elseBranch: {
        type: 'BINARY_OP',
        operator: '*',
        left: { type: 'VARIABLE', name: 'Weight' },
        right: { type: 'LITERAL', value: 2.0, unit: 'EGP/g' },
      },
    };

    // Case A: Weight <= 500g (e.g. 100g -> 100 * 2.0 = 200 EGP)
    const lightModel: ModelVariablesContext = {
      width: 10, height: 10, depth: 10,
      volumeCm3: 100, volume: 100000,
      boundingBoxVolume: 100000, surfaceArea: 600,
      infill: 0.2, layerHeight: 0.2, shellThickness: 0.9,
      quantity: 1, density: 1.0, // 100g
    };
    const resLight = PricingEngineService.calculatePricing({
      modelContext: lightModel,
      customVariables,
      constants: [],
      equationTree,
    });
    expect(resLight.unitPrice).toBe(200);

    // Case B: Weight > 500g (e.g. 600g -> 600 * 1.5 = 900 EGP)
    const heavyModel: ModelVariablesContext = {
      width: 10, height: 10, depth: 10,
      volumeCm3: 600, volume: 600000,
      boundingBoxVolume: 600000, surfaceArea: 600,
      infill: 0.2, layerHeight: 0.2, shellThickness: 0.9,
      quantity: 1, density: 1.0, // 600g
    };
    const resHeavy = PricingEngineService.calculatePricing({
      modelContext: heavyModel,
      customVariables,
      constants: [],
      equationTree,
    });
    expect(resHeavy.unitPrice).toBe(900);
  });

  // Test 8 & 9 & 10: Comparison & Isolation
  it('Test 8 & Comparison — Draft Isolation: compares Draft vs Published without mutating published', () => {
    const publishedEquation = {
      tree: {
        type: 'BINARY_OP' as const,
        operator: '*' as const,
        left: { type: 'VARIABLE' as const, name: 'Volume' },
        right: { type: 'LITERAL' as const, value: 2, unit: 'EGP/g' as const },
      },
      customVariables: [],
      constants: {},
      version: 1,
    };

    const draftEquation = {
      tree: {
        type: 'BINARY_OP' as const,
        operator: '*' as const,
        left: { type: 'VARIABLE' as const, name: 'Volume' },
        right: { type: 'LITERAL' as const, value: 3, unit: 'EGP/g' as const },
      },
      customVariables: [],
      constants: {},
      version: 2,
    };

    const model: ModelVariablesContext = {
      width: 10, height: 10, depth: 10,
      volumeCm3: 10, volume: 10000,
      boundingBoxVolume: 10000, surfaceArea: 600,
      infill: 0.2, layerHeight: 0.2, shellThickness: 0.9,
      quantity: 1,
    };

    const comp = PricingEngineService.compareEquations({
      modelContext: model,
      publishedEquation,
      draftEquation,
    });

    expect(comp.previousPrice).toBe(20);
    expect(comp.newPrice).toBe(30);
    expect(comp.differenceEgp).toBe(10);
    expect(comp.percentDifference).toBe(50);
  });

  // Test 11: Zero 9% Platform Fee
  it('Test 11 — No Platform Fee: verifies zero platform fee exists in pricing calculation', () => {
    const model: ModelVariablesContext = {
      width: 10, height: 10, depth: 10,
      volumeCm3: 10, volume: 10000,
      boundingBoxVolume: 10000, surfaceArea: 600,
      infill: 0.2, layerHeight: 0.2, shellThickness: 0.9,
      quantity: 1,
    };
    const equationTree: AstNode = {
      type: 'LITERAL',
      value: 100,
      unit: 'EGP',
    };
    const result = PricingEngineService.calculatePricing({
      modelContext: model,
      customVariables: [],
      constants: [],
      equationTree,
    });

    expect(result.totalPrice).toBe(100);
    expect((result.breakdown as any).platformFee).toBeUndefined();
    expect((result.breakdown as any).platformFeeRate).toBeUndefined();
  });

  // Test 12: Currency is EGP
  it('Test 12 — EGP: customer-facing currency is strictly EGP', () => {
    const model: ModelVariablesContext = {
      width: 10, height: 10, depth: 10,
      volumeCm3: 10, volume: 10000,
      boundingBoxVolume: 10000, surfaceArea: 600,
      infill: 0.2, layerHeight: 0.2, shellThickness: 0.9,
      quantity: 1,
    };
    const result = PricingEngineService.calculatePricing({
      modelContext: model,
      customVariables: [],
      constants: [],
      equationTree: { type: 'LITERAL', value: 50, unit: 'EGP' },
    });

    expect(result.currency).toBe('EGP');
    expect(result.breakdown.currency).toBe('EGP');
  });

  // Circular Dependency Detection Test
  it('Circular Dependencies: detects and rejects circular variable references (A -> B -> C -> A)', () => {
    const cyclicVariables: CustomVariableDefinition[] = [
      {
        code: 'A',
        name: 'A',
        unit: 'EGP',
        dataType: 'number',
        formulaTree: { type: 'VARIABLE', name: 'B' },
        dependencies: ['B'],
        isEnabled: true,
      },
      {
        code: 'B',
        name: 'B',
        unit: 'EGP',
        dataType: 'number',
        formulaTree: { type: 'VARIABLE', name: 'C' },
        dependencies: ['C'],
        isEnabled: true,
      },
      {
        code: 'C',
        name: 'C',
        unit: 'EGP',
        dataType: 'number',
        formulaTree: { type: 'VARIABLE', name: 'A' },
        dependencies: ['A'],
        isEnabled: true,
      },
    ];

    expect(() => {
      PricingEngineService.validateDependencies(cyclicVariables);
    }).toThrow(/Circular dependency detected/);
  });

  // Unit Incompatibility Test
  it('Unit Validation: rejects invalid unit combinations (e.g. mm + hour)', () => {
    expect(() => {
      UnitAlgebra.evaluateBinaryUnit('mm', 'hour', '+');
    }).toThrow(/Incompatible units/);
  });

  // Power operation test
  it('Power Operation: evaluates exponentiation correctly', () => {
    const node: AstNode = {
      type: 'BINARY_OP',
      operator: '^',
      left: { type: 'LITERAL', value: 3, unit: 'mm' },
      right: { type: 'LITERAL', value: 2, unit: 'unitless' },
    };
    const result = PricingEngineService.evaluateAst(node, {}, {});
    expect(result.value).toBe(9);
    expect(result.unit).toBe('mm2');
  });
});
