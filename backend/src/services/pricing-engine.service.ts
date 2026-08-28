/**
 * CAM LABS Authoritative Pricing Engine & AST Evaluator
 *
 * Implements a secure, unit-aware Abstract Syntax Tree evaluator for pricing formulas,
 * reusable custom variables with circular dependency detection, configurable constants,
 * IF conditional logic, and detailed itemized breakdown generation.
 */

import {
  AstNode,
  BinaryOperator,
  ComparisonOperator,
  LogicalOperator,
  PricingUnit,
  EvaluatedValue,
  ModelVariablesContext,
  CustomVariableDefinition,
  PricingConstantDefinition,
  PricingBreakdownResult,
  PricingEvaluationResult,
  PricingBreakdownComponent,
} from './pricing-ast.types';
import { Logger } from '../utils/logger';

export class UnitAlgebra {
  /**
   * Normalize unit string to standard internal key
   */
  static normalize(unit?: string): PricingUnit {
    if (!unit) return 'unitless';
    const lower = unit.trim().toLowerCase().replace(/\s+/g, '');
    if (lower === 'mm' || lower === 'millimeter' || lower === 'millimeters') return 'mm';
    if (lower === 'mm2' || lower === 'mm²' || lower === 'sqmm') return 'mm2';
    if (lower === 'mm3' || lower === 'mm³' || lower === 'cubmicmm') return 'mm3';
    if (lower === 'cm' || lower === 'centimeter') return 'cm';
    if (lower === 'cm2' || lower === 'cm²') return 'cm2';
    if (lower === 'cm3' || lower === 'cm³' || lower === 'cc') return 'cm3';
    if (lower === 'm' || lower === 'meter') return 'm';
    if (lower === 'g' || lower === 'gram' || lower === 'grams') return 'g';
    if (lower === 'kg' || lower === 'kilogram' || lower === 'kilograms') return 'kg';
    if (lower === 'hr' || lower === 'hour' || lower === 'hours') return 'hour';
    if (lower === 'min' || lower === 'minute' || lower === 'minutes') return 'minute';
    if (lower === 'sec' || lower === 'second' || lower === 'seconds') return 'second';
    if (lower === 'egp' || lower === 'le' || lower === 'l.e.') return 'EGP';
    if (lower === 'egp/g' || lower === 'egp/gram') return 'EGP/g';
    if (lower === 'egp/kg') return 'EGP/kg';
    if (lower === 'egp/hour' || lower === 'egp/hr') return 'EGP/hour';
    if (lower === 'egp/minute' || lower === 'egp/min') return 'EGP/minute';
    if (lower === 'g/cm3' || lower === 'g/cm³' || lower === 'g/cc') return 'g/cm3';
    if (lower === 'g/mm3' || lower === 'g/mm³') return 'g/mm3';
    if (lower === '%' || lower === 'percent' || lower === 'percentage') return 'percentage';
    if (lower === 'unitless' || lower === 'count' || lower === 'pcs' || lower === 'dimensionless') return 'unitless';
    return 'unitless';
  }

  /**
   * Determine result unit and validate operation compatibility
   */
  static evaluateBinaryUnit(
    leftUnit: PricingUnit,
    rightUnit: PricingUnit,
    op: BinaryOperator,
    rightValue?: number
  ): PricingUnit {
    const l = this.normalize(leftUnit);
    const r = this.normalize(rightUnit);

    // Percentage handling: e.g. EGP * percentage = EGP, 20% * 100 EGP = 20 EGP
    if (op === '*') {
      if (l === 'percentage' && r !== 'percentage') return r;
      if (r === 'percentage' && l !== 'percentage') return l;
      if (l === 'unitless') return r;
      if (r === 'unitless') return l;

      // Rate multiplication:
      // EGP/g * g -> EGP
      if (l === 'EGP/g' && (r === 'g' || r === 'kg')) return 'EGP';
      if ((l === 'g' || l === 'kg') && r === 'EGP/g') return 'EGP';
      // EGP/hour * hour -> EGP
      if (l === 'EGP/hour' && (r === 'hour' || r === 'minute' || r === 'second')) return 'EGP';
      if ((l === 'hour' || l === 'minute' || l === 'second') && r === 'EGP/hour') return 'EGP';
      // EGP/minute * minute -> EGP
      if (l === 'EGP/minute' && (r === 'minute' || r === 'second' || r === 'hour')) return 'EGP';
      if ((l === 'minute' || l === 'second' || l === 'hour') && r === 'EGP/minute') return 'EGP';
      // Density * Volume: g/cm3 * cm3 -> g, g/cm3 * mm3 -> g
      if (l === 'g/cm3' && (r === 'cm3' || r === 'mm3')) return 'g';
      if ((l === 'cm3' || l === 'mm3') && r === 'g/cm3') return 'g';
      // mm * mm -> mm2, mm * mm2 -> mm3, cm * cm -> cm2, cm * cm2 -> cm3
      if (l === 'mm' && r === 'mm') return 'mm2';
      if (l === 'mm' && r === 'mm2') return 'mm3';
      if (l === 'mm2' && r === 'mm') return 'mm3';
      if (l === 'cm' && r === 'cm') return 'cm2';
      if (l === 'cm' && r === 'cm2') return 'cm3';
      if (l === 'cm2' && r === 'cm') return 'cm3';
    }

    if (op === '/') {
      if (r === 'unitless' || r === 'percentage') return l;
      if (l === r) return 'unitless';
      // EGP / g -> EGP/g
      if (l === 'EGP' && r === 'g') return 'EGP/g';
      if (l === 'EGP' && r === 'kg') return 'EGP/kg';
      // EGP / hour -> EGP/hour
      if (l === 'EGP' && r === 'hour') return 'EGP/hour';
      if (l === 'EGP' && r === 'minute') return 'EGP/minute';
      // g / cm3 -> g/cm3
      if (l === 'g' && r === 'cm3') return 'g/cm3';
      // mm3 / mm -> mm2, mm3 / mm2 -> mm
      if (l === 'mm3' && r === 'mm') return 'mm2';
      if (l === 'mm3' && r === 'mm2') return 'mm';
      if (l === 'cm3' && r === 'cm') return 'cm2';
      if (l === 'cm3' && r === 'cm2') return 'cm';
    }

    if (op === '+' || op === '-') {
      if (l === r) return l;
      if (l === 'unitless' || r === 'unitless') return l !== 'unitless' ? l : r;
      // Compatible dimensional additions
      if ((l === 'mm3' && r === 'cm3') || (l === 'cm3' && r === 'mm3')) return 'cm3';
      if ((l === 'mm2' && r === 'cm2') || (l === 'cm2' && r === 'mm2')) return 'cm2';
      if ((l === 'mm' && r === 'cm') || (l === 'cm' && r === 'mm')) return 'mm';
      if ((l === 'g' && r === 'kg') || (l === 'kg' && r === 'g')) return 'g';
      if ((l === 'hour' && r === 'minute') || (l === 'minute' && r === 'hour')) return 'hour';
      if ((l === 'minute' && r === 'second') || (l === 'second' && r === 'minute')) return 'minute';

      throw new Error(`Incompatible units for operation '${op}': '${leftUnit}' and '${rightUnit}'.`);
    }

    if (op === '^') {
      if (r !== 'unitless' && r !== 'percentage') {
        throw new Error(`Exponent in power operation must be a unitless number, got '${rightUnit}'.`);
      }
      if (l === 'mm' && rightValue === 2) return 'mm2';
      if (l === 'mm' && rightValue === 3) return 'mm3';
      if (l === 'cm' && rightValue === 2) return 'cm2';
      if (l === 'cm' && rightValue === 3) return 'cm3';
      if (l === 'unitless' || l === 'percentage') return l;
      return l;
    }

    return l !== 'unitless' ? l : r;
  }

  /**
   * Convert value to compatible target unit if necessary
   */
  static convertUnit(value: number, fromUnit: PricingUnit, toUnit: PricingUnit): number {
    const f = this.normalize(fromUnit);
    const t = this.normalize(toUnit);
    if (f === t) return value;

    // Length
    if (f === 'mm' && t === 'cm') return value / 10;
    if (f === 'cm' && t === 'mm') return value * 10;
    if (f === 'mm' && t === 'm') return value / 1000;
    if (f === 'm' && t === 'mm') return value * 1000;

    // Area
    if (f === 'mm2' && t === 'cm2') return value / 100;
    if (f === 'cm2' && t === 'mm2') return value * 100;

    // Volume
    if (f === 'mm3' && t === 'cm3') return value / 1000;
    if (f === 'cm3' && t === 'mm3') return value * 1000;

    // Mass
    if (f === 'g' && t === 'kg') return value / 1000;
    if (f === 'kg' && t === 'g') return value * 1000;

    // Time
    if (f === 'hour' && t === 'minute') return value * 60;
    if (f === 'minute' && t === 'hour') return value / 60;
    if (f === 'minute' && t === 'second') return value * 60;
    if (f === 'second' && t === 'minute') return value / 60;
    if (f === 'hour' && t === 'second') return value * 3600;
    if (f === 'second' && t === 'hour') return value / 3600;

    return value;
  }
}

export class PricingEngineService {
  private static readonly MAX_DEPTH = 50;

  /**
   * Check for circular dependencies in custom variables using DFS cycle detection
   */
  static validateDependencies(variables: CustomVariableDefinition[]): void {
    const graph: Map<string, string[]> = new Map();
    const varMap: Map<string, CustomVariableDefinition> = new Map();

    for (const v of variables) {
      const code = this.normalizeIdentifier(v.code);
      varMap.set(code, v);
      graph.set(code, (v.dependencies || []).map((d) => this.normalizeIdentifier(d)));
    }

    const visited: Map<string, 'VISITING' | 'VISITED'> = new Map();

    const dfs = (node: string, path: string[]) => {
      const state = visited.get(node);
      if (state === 'VISITING') {
        const cyclePath = [...path, node].join(' → ');
        throw new Error(`Circular dependency detected in custom variables: ${cyclePath}`);
      }
      if (state === 'VISITED') return;

      visited.set(node, 'VISITING');
      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (graph.has(neighbor)) {
          dfs(neighbor, [...path, node]);
        }
      }
      visited.set(node, 'VISITED');
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }
  }

  /**
   * Topologically sort custom variables so dependencies evaluate first
   */
  static sortVariablesTopologically(variables: CustomVariableDefinition[]): CustomVariableDefinition[] {
    this.validateDependencies(variables);

    const graph: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();
    const map: Map<string, CustomVariableDefinition> = new Map();

    for (const v of variables) {
      const code = this.normalizeIdentifier(v.code);
      map.set(code, v);
      graph.set(code, []);
      inDegree.set(code, 0);
    }

    for (const v of variables) {
      const code = this.normalizeIdentifier(v.code);
      const deps = (v.dependencies || []).map((d) => this.normalizeIdentifier(d));
      for (const dep of deps) {
        if (graph.has(dep)) {
          graph.get(dep)!.push(code);
          inDegree.set(code, (inDegree.get(code) || 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [code, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(code);
    }

    const sorted: CustomVariableDefinition[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const item = map.get(current);
      if (item) sorted.push(item);

      const neighbors = graph.get(current) || [];
      for (const next of neighbors) {
        const deg = (inDegree.get(next) || 1) - 1;
        inDegree.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }

    if (sorted.length !== variables.length) {
      // Any remaining items without dependencies
      for (const v of variables) {
        if (!sorted.some((s) => this.normalizeIdentifier(s.code) === this.normalizeIdentifier(v.code))) {
          sorted.push(v);
        }
      }
    }

    return sorted;
  }

  /**
   * Normalize an identifier for case/space-insensitive lookup
   */
  static normalizeIdentifier(name: string): string {
    return name.trim().toLowerCase().replace(/[\s_\-]+/g, '');
  }

  /**
   * Extract AST dependencies from an AST tree
   */
  static extractAstDependencies(node: AstNode): string[] {
    const deps = new Set<string>();
    const traverse = (n: AstNode) => {
      if (!n) return;
      if (n.type === 'VARIABLE') {
        deps.add(n.name);
      } else if (n.type === 'BINARY_OP') {
        traverse(n.left);
        traverse(n.right);
      } else if (n.type === 'UNARY_OP') {
        traverse(n.operand);
      } else if (n.type === 'CONDITION') {
        traverse(n.left);
        if (n.right) traverse(n.right);
      } else if (n.type === 'IF_ELSE') {
        traverse(n.condition);
        traverse(n.thenBranch);
        traverse(n.elseBranch);
      } else if (n.type === 'GROUP') {
        traverse(n.expression);
      }
    };
    traverse(node);
    return Array.from(deps);
  }

  /**
   * Evaluate an AST expression safely without eval
   */
  static evaluateAst(
    node: AstNode,
    context: Record<string, EvaluatedValue>,
    constants: Record<string, EvaluatedValue>,
    depth = 0
  ): EvaluatedValue {
    if (depth > this.MAX_DEPTH) {
      throw new Error(`Maximum equation AST depth of ${this.MAX_DEPTH} exceeded.`);
    }

    if (!node) {
      throw new Error('Invalid empty AST node encountered.');
    }

    switch (node.type) {
      case 'LITERAL': {
        const unit = UnitAlgebra.normalize(node.unit);
        return { value: Number(node.value), unit };
      }

      case 'VARIABLE': {
        const norm = this.normalizeIdentifier(node.name);
        const resolved = context[norm];
        if (!resolved) {
          // Check if it's available in constants as fallback
          const constantFallback = constants[norm];
          if (constantFallback) return constantFallback;
          throw new Error(`Undefined variable '${node.name}' in equation context.`);
        }
        return resolved;
      }

      case 'CONSTANT': {
        const norm = this.normalizeIdentifier(node.name);
        const resolved = constants[norm];
        if (!resolved) {
          // Check if available in variables as fallback
          const varFallback = context[norm];
          if (varFallback) return varFallback;
          throw new Error(`Undefined constant '${node.name}' in pricing configuration.`);
        }
        return resolved;
      }

      case 'GROUP': {
        return this.evaluateAst(node.expression, context, constants, depth + 1);
      }

      case 'UNARY_OP': {
        const operand = this.evaluateAst(node.operand, context, constants, depth + 1);
        const numVal = Number(operand.value);
        if (Number.isNaN(numVal)) throw new Error(`Cannot apply unary operator ${node.operator} to non-numeric value.`);

        let resultVal = numVal;
        switch (node.operator) {
          case 'NEG': resultVal = -numVal; break;
          case 'POS': resultVal = +numVal; break;
          case 'ABS': resultVal = Math.abs(numVal); break;
          case 'CEIL': resultVal = Math.ceil(numVal); break;
          case 'FLOOR': resultVal = Math.floor(numVal); break;
          case 'ROUND': resultVal = Math.round(numVal); break;
          default: throw new Error(`Unsupported unary operator: ${(node as any).operator}`);
        }
        return { value: resultVal, unit: operand.unit };
      }

      case 'BINARY_OP': {
        const left = this.evaluateAst(node.left, context, constants, depth + 1);
        const right = this.evaluateAst(node.right, context, constants, depth + 1);

        let leftNum = Number(left.value);
        let rightNum = Number(right.value);

        if (Number.isNaN(leftNum) || Number.isNaN(rightNum)) {
          throw new Error(`Binary operation '${node.operator}' requires numeric operands.`);
        }

        // Percentage conversion: if percentage is e.g. 20 (meaning 20%), convert to 0.20 for calculation
        const leftIsPct = left.unit === 'percentage';
        const rightIsPct = right.unit === 'percentage';
        const leftEffectiveVal = leftIsPct && Math.abs(leftNum) > 1 ? leftNum / 100 : leftNum;
        const rightEffectiveVal = rightIsPct && Math.abs(rightNum) > 1 ? rightNum / 100 : rightNum;

        // Density * Volume conversion: g/cm3 * mm3 -> convert mm3 to cm3 first
        if (node.operator === '*') {
          if (left.unit === 'g/cm3' && right.unit === 'mm3') {
            rightNum = rightNum / 1000;
          } else if (left.unit === 'mm3' && right.unit === 'g/cm3') {
            leftNum = leftNum / 1000;
          }
          // Rate * Time: EGP/hour * minute -> convert minute to hour
          if (left.unit === 'EGP/hour' && right.unit === 'minute') {
            rightNum = rightNum / 60;
          } else if (left.unit === 'minute' && right.unit === 'EGP/hour') {
            leftNum = leftNum / 60;
          }
        }

        const lVal = leftIsPct ? leftEffectiveVal : leftNum;
        const rVal = rightIsPct ? rightEffectiveVal : rightNum;

        const resultUnit = UnitAlgebra.evaluateBinaryUnit(left.unit, right.unit, node.operator, rVal);

        let resultVal = 0;
        switch (node.operator) {
          case '+': {
            const convertedRight = UnitAlgebra.convertUnit(rVal, right.unit, resultUnit);
            const convertedLeft = UnitAlgebra.convertUnit(lVal, left.unit, resultUnit);
            resultVal = convertedLeft + convertedRight;
            break;
          }
          case '-': {
            const convertedRight = UnitAlgebra.convertUnit(rVal, right.unit, resultUnit);
            const convertedLeft = UnitAlgebra.convertUnit(lVal, left.unit, resultUnit);
            resultVal = convertedLeft - convertedRight;
            break;
          }
          case '*': {
            resultVal = lVal * rVal;
            break;
          }
          case '/': {
            if (rVal === 0) throw new Error('Division by zero in pricing equation.');
            resultVal = lVal / rVal;
            break;
          }
          case '^': {
            resultVal = Math.pow(lVal, rVal);
            break;
          }
          default:
            throw new Error(`Unsupported binary operator: ${(node as any).operator}`);
        }

        return { value: resultVal, unit: resultUnit };
      }

      case 'CONDITION': {
        const left = this.evaluateAst(node.left, context, constants, depth + 1);

        if (node.operator === 'NOT') {
          return { value: !left.value, unit: 'unitless' };
        }

        if (!node.right) {
          throw new Error(`Condition operator '${node.operator}' requires right operand.`);
        }

        const right = this.evaluateAst(node.right, context, constants, depth + 1);

        if (node.operator === 'AND') {
          return { value: Boolean(left.value) && Boolean(right.value), unit: 'unitless' };
        }
        if (node.operator === 'OR') {
          return { value: Boolean(left.value) || Boolean(right.value), unit: 'unitless' };
        }

        const lNum = Number(left.value);
        let rNum = Number(right.value);

        // Convert units for comparison if compatible
        if (left.unit !== right.unit) {
          try {
            rNum = UnitAlgebra.convertUnit(rNum, right.unit, left.unit);
          } catch {
            // Keep original values if conversion unsupported
          }
        }

        let condResult = false;
        switch (node.operator) {
          case '>': condResult = lNum > rNum; break;
          case '<': condResult = lNum < rNum; break;
          case '>=': condResult = lNum >= rNum; break;
          case '<=': condResult = lNum <= rNum; break;
          case '==':
          case '=': condResult = lNum === rNum; break;
          case '!=': condResult = lNum !== rNum; break;
          default: throw new Error(`Unsupported condition operator: ${node.operator}`);
        }

        return { value: condResult, unit: 'unitless' };
      }

      case 'IF_ELSE': {
        const cond = this.evaluateAst(node.condition, context, constants, depth + 1);
        if (Boolean(cond.value)) {
          return this.evaluateAst(node.thenBranch, context, constants, depth + 1);
        } else {
          return this.evaluateAst(node.elseBranch, context, constants, depth + 1);
        }
      }

      default:
        throw new Error(`Unknown AST node type: ${(node as any).type}`);
    }
  }

  /**
   * Build complete context with predefined model variables
   */
  static buildModelVariablesContext(raw: ModelVariablesContext): Record<string, EvaluatedValue> {
    const ctx: Record<string, EvaluatedValue> = {};

    const add = (code: string, value: number | boolean | string, unit: PricingUnit) => {
      ctx[this.normalizeIdentifier(code)] = { value: typeof value === 'boolean' ? value : Number(value), unit };
    };

    // Predefined Model Variables required by specification
    const dims = raw.dimensionsMm as { width?: number; height?: number; depth?: number } | undefined;
    const width = Number(raw.width ?? dims?.width ?? 0);
    const height = Number(raw.height ?? dims?.height ?? 0);
    const depth = Number(raw.depth ?? dims?.depth ?? 0);

    const volumeCm3 = Number(raw.volumeCm3 ?? (raw.volume ? Number(raw.volume) / 1000 : (width * height * depth) / 1000));
    const volumeMm3 = Number(raw.volume ?? volumeCm3 * 1000);
    const surfaceAreaCm2 = Number(raw.surfaceAreaCm2 ?? (raw.surfaceArea ? Number(raw.surfaceArea) / 100 : 0));
    const surfaceAreaMm2 = Number(raw.surfaceArea ?? surfaceAreaCm2 * 100);

    const boundingBoxVolumeMm3 = Number(raw.boundingBoxVolume ?? width * height * depth);
    const boundingBoxVolumeCm3 = boundingBoxVolumeMm3 / 1000;
    const convexHullVolumeMm3 = Number(raw.convexHullVolume ?? boundingBoxVolumeMm3);
    const convexHullVolumeCm3 = convexHullVolumeMm3 / 1000;

    const infillRaw = Number(raw.infill ?? raw.infillPercent ?? 20);
    const infillRatio = infillRaw > 1 ? infillRaw / 100 : infillRaw;
    const layerHeight = Number(raw.layerHeight ?? raw.layerHeightMm ?? 0.2);
    const wallCount = Number(raw.wallCount ?? 2);
    const lineWidthMm = Number(raw.lineWidthMm ?? 0.45);
    const shellThickness = Number(raw.shellThickness ?? (wallCount * lineWidthMm));

    const quantity = Math.max(1, Number(raw.quantity || 1));
    const density = Number(raw.density ?? (raw.materialDensityGramsPerCm3 ?? 1.24)); // g/cm3

    const machineTimeMinutes = Number(raw.machineTimeMinutes ?? (raw.machineTime ? Number(raw.machineTime) * 60 : 10));
    const machineTimeHours = Number(raw.machineTimeHours ?? machineTimeMinutes / 60);

    // Populate all standard names and aliases
    add('width', width, 'mm');
    add('height', height, 'mm');
    add('depth', depth, 'mm');
    add('volume', volumeCm3, 'cm3');
    add('volumemm3', volumeMm3, 'mm3');
    add('volumecm3', volumeCm3, 'cm3');
    add('boundingboxvolume', boundingBoxVolumeCm3, 'cm3');
    add('boundingboxvolumecm3', boundingBoxVolumeCm3, 'cm3');
    add('boundingboxvolumemm3', boundingBoxVolumeMm3, 'mm3');
    add('convexhullvolume', convexHullVolumeCm3, 'cm3');
    add('convexhullvolumecm3', convexHullVolumeCm3, 'cm3');
    add('convexhullvolumemm3', convexHullVolumeMm3, 'mm3');
    add('surfacearea', surfaceAreaCm2, 'cm2');
    add('surfaceareacm2', surfaceAreaCm2, 'cm2');
    add('surfaceareamm2', surfaceAreaMm2, 'mm2');
    add('infill', infillRatio, 'percentage');
    add('infillpercent', infillRaw, 'percentage');
    add('layerheight', layerHeight, 'mm');
    add('shellthickness', shellThickness, 'mm');
    add('quantity', quantity, 'unitless');
    add('density', density, 'g/cm3');
    add('machinetime', machineTimeHours, 'hour');
    add('machinetimeminutes', machineTimeMinutes, 'minute');
    add('machinetimehours', machineTimeHours, 'hour');

    if (raw.materialPrice !== undefined) {
      add('materialprice', raw.materialPrice, 'EGP/g');
      add('plaprice', raw.materialPrice, 'EGP/g');
    }

    return ctx;
  }

  /**
   * Build constants context map
   */
  static buildConstantsContext(constants: PricingConstantDefinition[] | Record<string, { value: number; unit: PricingUnit }>): Record<string, EvaluatedValue> {
    const map: Record<string, EvaluatedValue> = {};

    if (Array.isArray(constants)) {
      for (const c of constants) {
        const normKey = this.normalizeIdentifier(c.key);
        const normName = this.normalizeIdentifier(c.name);
        const entry: EvaluatedValue = { value: Number(c.value), unit: UnitAlgebra.normalize(c.unit) };
        map[normKey] = entry;
        map[normName] = entry;
      }
    } else {
      for (const [k, v] of Object.entries(constants)) {
        const norm = this.normalizeIdentifier(k);
        map[norm] = { value: Number(v.value), unit: UnitAlgebra.normalize(v.unit) };
      }
    }

    return map;
  }

  /**
   * Complete calculation pipeline:
   * 1. Extract model variables
   * 2. Resolve constants
   * 3. Sort and evaluate custom variables
   * 4. Evaluate main pricing AST
   * 5. Generate structured itemized breakdown
   */
  static calculatePricing(params: {
    modelContext: ModelVariablesContext;
    customVariables: CustomVariableDefinition[];
    constants: PricingConstantDefinition[] | Record<string, { value: number; unit: PricingUnit }>;
    equationTree: AstNode;
    equationVersionId?: string;
    equationVersion?: number;
  }): PricingEvaluationResult {
    const { modelContext, customVariables, constants, equationTree } = params;

    // 1. Predefined model variables
    const evalContext = this.buildModelVariablesContext(modelContext);

    // 2. Pricing constants
    const evalConstants = this.buildConstantsContext(constants);

    // 3. Topologically sort and evaluate custom variables
    const sortedVars = this.sortVariablesTopologically(customVariables);
    const evaluatedCustomVars: Record<string, { value: number | boolean; unit: PricingUnit; formatted: string }> = {};

    for (const cv of sortedVars) {
      if (!cv.isEnabled && cv.isEnabled !== undefined) continue;
      const res = this.evaluateAst(cv.formulaTree, evalContext, evalConstants);
      const normCode = this.normalizeIdentifier(cv.code);
      const normName = this.normalizeIdentifier(cv.name);
      evalContext[normCode] = res;
      evalContext[normName] = res;

      evaluatedCustomVars[cv.code] = {
        value: res.value,
        unit: res.unit,
        formatted: typeof res.value === 'number' ? `${res.value.toFixed(2)} ${res.unit}` : String(res.value),
      };
    }

    // 4. Evaluate main equation
    const mainResult = this.evaluateAst(equationTree, evalContext, evalConstants);
    const calculatedCost = Number(mainResult.value);

    if (!Number.isFinite(calculatedCost) || calculatedCost < 0) {
      throw new Error(`Equation produced an invalid pricing result: ${calculatedCost}`);
    }

    // Extract itemized components from evaluated variables or constants
    const quantity = Math.max(1, modelContext.quantity || 1);

    // Identify standard components if available in custom variables or context
    const getVarValue = (key: string): number => {
      const entry = evalContext[PricingEngineService.normalizeIdentifier(key)];
      return entry && typeof entry.value === 'number' ? entry.value : 0;
    };

    const materialCostUnit = getVarValue('materialcost') || getVarValue('material_cost') || getVarValue('materialCost');
    const machineCostUnit = getVarValue('machinecost') || getVarValue('machine_cost') || getVarValue('machineCost');
    const baseCostUnit = getVarValue('basecost') || getVarValue('base_cost') || (materialCostUnit + machineCostUnit) || (calculatedCost / quantity);
    
    // Profit calculation:
    const profitMarginConst = evalConstants[this.normalizeIdentifier('PROFIT_MARGIN')] || evalConstants[this.normalizeIdentifier('profitmargin')];
    let profitMarginPct = 0.20; // Default 20%
    if (profitMarginConst) {
      const pmVal = Number(profitMarginConst.value);
      profitMarginPct = pmVal > 1 ? pmVal / 100 : pmVal;
    }

    const explicitProfit = getVarValue('profit');
    const profit = explicitProfit > 0 ? explicitProfit : (baseCostUnit * profitMarginPct);

    // Total Unit Price and Order Total
    // If the formula calculates total directly (accounting for quantity), or unit price:
    const finalUnitPrice = parseFloat((calculatedCost).toFixed(2));
    const finalTotalPrice = parseFloat((finalUnitPrice * quantity).toFixed(2));

    const components: PricingBreakdownComponent[] = [];

    for (const [code, info] of Object.entries(evaluatedCustomVars)) {
      components.push({
        code,
        name: code,
        value: typeof info.value === 'number' ? info.value : 0,
        unit: info.unit,
        formatted: info.formatted,
      });
    }

    const constantsUsed: Record<string, { value: number; unit: PricingUnit }> = {};
    if (Array.isArray(constants)) {
      for (const c of constants) {
        constantsUsed[c.key] = { value: c.value, unit: c.unit };
      }
    } else {
      for (const [k, v] of Object.entries(constants)) {
        constantsUsed[k] = { value: v.value, unit: v.unit };
      }
    }

    const breakdown: PricingBreakdownResult = {
      materialCost: parseFloat((materialCostUnit || (finalUnitPrice * 0.4)).toFixed(2)),
      machineCost: parseFloat((machineCostUnit || (finalUnitPrice * 0.4)).toFixed(2)),
      baseCost: parseFloat((baseCostUnit).toFixed(2)),
      profit: parseFloat((profit * quantity).toFixed(2)),
      profitMarginPercentage: profitMarginPct * 100,
      quantity,
      finalUnitPrice,
      finalTotalPrice,
      currency: 'EGP',
      customVariablesEvaluated: evaluatedCustomVars,
      components,
      constantsUsed,
    };

    return {
      unitPrice: finalUnitPrice,
      totalPrice: finalTotalPrice,
      currency: 'EGP',
      breakdown,
      equationVersionId: params.equationVersionId,
      equationVersion: params.equationVersion,
    };
  }

  /**
   * Run comparative pricing between draft and published equation
   */
  static compareEquations(params: {
    modelContext: ModelVariablesContext;
    publishedEquation: {
      tree: AstNode;
      customVariables: CustomVariableDefinition[];
      constants: PricingConstantDefinition[] | Record<string, { value: number; unit: PricingUnit }>;
      version: number;
      versionId?: string;
    };
    draftEquation: {
      tree: AstNode;
      customVariables: CustomVariableDefinition[];
      constants: PricingConstantDefinition[] | Record<string, { value: number; unit: PricingUnit }>;
      version?: number;
      versionId?: string;
    };
  }) {
    const publishedResult = this.calculatePricing({
      modelContext: params.modelContext,
      customVariables: params.publishedEquation.customVariables,
      constants: params.publishedEquation.constants,
      equationTree: params.publishedEquation.tree,
      equationVersionId: params.publishedEquation.versionId,
      equationVersion: params.publishedEquation.version,
    });

    const draftResult = this.calculatePricing({
      modelContext: params.modelContext,
      customVariables: params.draftEquation.customVariables,
      constants: params.draftEquation.constants,
      equationTree: params.draftEquation.tree,
      equationVersionId: params.draftEquation.versionId,
      equationVersion: params.draftEquation.version,
    });

    const previousPrice = publishedResult.totalPrice;
    const newPrice = draftResult.totalPrice;
    const differenceEgp = parseFloat((newPrice - previousPrice).toFixed(2));
    const percentDifference = previousPrice === 0 ? 0 : parseFloat((((newPrice - previousPrice) / previousPrice) * 100).toFixed(2));

    return {
      previousPrice,
      newPrice,
      differenceEgp,
      percentDifference,
      currency: 'EGP' as const,
      publishedBreakdown: publishedResult.breakdown,
      draftBreakdown: draftResult.breakdown,
      publishedResult,
      draftResult,
    };
  }
}
