/**
 * Pricing Engine AST and Unit Type Definitions
 * CAM LABS Authoritative Pricing & Equation Builder
 */

export type PricingUnit =
  | 'mm'
  | 'mm2'
  | 'mm3'
  | 'cm'
  | 'cm2'
  | 'cm3'
  | 'm'
  | 'g'
  | 'kg'
  | 'hour'
  | 'minute'
  | 'second'
  | 'EGP'
  | 'EGP/g'
  | 'EGP/kg'
  | 'EGP/hour'
  | 'EGP/minute'
  | 'EGP/cm2'
  | 'EGP/mm2'
  | 'g/cm3'
  | 'g/mm3'
  | 'percentage'
  | 'unitless';

export type BinaryOperator = '+' | '-' | '*' | '/' | '^';
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '=' | '!=';
export type LogicalOperator = 'AND' | 'OR' | 'NOT';
export type UnaryOperator = 'NEG' | 'POS' | 'ABS' | 'CEIL' | 'FLOOR' | 'ROUND';

export type AstNodeType =
  | 'LITERAL'
  | 'VARIABLE'
  | 'CONSTANT'
  | 'BINARY_OP'
  | 'UNARY_OP'
  | 'CONDITION'
  | 'IF_ELSE'
  | 'GROUP';

export interface LiteralNode {
  type: 'LITERAL';
  value: number;
  unit?: PricingUnit;
}

export interface VariableNode {
  type: 'VARIABLE';
  name: string; // Identifier code, e.g. "Volume", "Weight", "Infill"
}

export interface ConstantNode {
  type: 'CONSTANT';
  name: string; // Constant key, e.g. "PLA_PRICE", "MACHINE_HOURLY_RATE", "PROFIT_MARGIN"
}

export interface BinaryOpNode {
  type: 'BINARY_OP';
  operator: BinaryOperator;
  left: AstNode;
  right: AstNode;
}

export interface UnaryOpNode {
  type: 'UNARY_OP';
  operator: UnaryOperator;
  operand: AstNode;
}

export interface ConditionNode {
  type: 'CONDITION';
  operator: ComparisonOperator | LogicalOperator;
  left: AstNode;
  right?: AstNode; // Optional for unary logical operators like NOT
}

export interface IfElseNode {
  type: 'IF_ELSE';
  condition: ConditionNode | AstNode;
  thenBranch: AstNode;
  elseBranch: AstNode;
}

export interface GroupNode {
  type: 'GROUP';
  expression: AstNode;
}

export type AstNode =
  | LiteralNode
  | VariableNode
  | ConstantNode
  | BinaryOpNode
  | UnaryOpNode
  | ConditionNode
  | IfElseNode
  | GroupNode;

export interface CustomVariableDefinition {
  code: string;
  name: string;
  description?: string;
  unit: PricingUnit;
  dataType: 'number' | 'boolean' | 'string';
  formulaTree: AstNode;
  dependencies: string[];
  isEnabled: boolean;
}

export interface PricingConstantDefinition {
  key: string;
  name: string;
  value: number;
  unit: PricingUnit;
  description?: string;
  technology?: string;
}

export interface EvaluatedValue {
  value: number | boolean;
  unit: PricingUnit;
}

export interface ModelVariablesContext {
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  dimensionsMm?: { width: number; depth: number; height: number };
  volume: number; // mm3 (or cm3 depending on unit, normalized to mm3)
  volumeCm3?: number;
  boundingBoxVolume: number; // mm3
  convexHullVolume?: number; // mm3
  surfaceArea: number; // mm2
  surfaceAreaCm2?: number;
  infill: number; // 0..1 ratio or percentage (e.g. 20%)
  infillPercent?: number;
  layerHeight: number; // mm
  layerHeightMm?: number;
  shellThickness: number; // mm
  wallCount?: number;
  lineWidthMm?: number;
  quantity: number;
  density?: number; // g/cm3
  materialDensityGramsPerCm3?: number;
  machineTime?: number; // hours or minutes
  machineTimeMinutes?: number;
  machineTimeHours?: number;
  materialPrice?: number; // EGP/g
  material?: string;
  technology?: string;
  [key: string]: any;
}

export interface PricingBreakdownComponent {
  code: string;
  name: string;
  value: number;
  unit: PricingUnit;
  formatted: string;
  description?: string;
}

export interface PricingBreakdownResult {
  materialCost: number;
  machineCost: number;
  otherCosts?: number;
  baseCost: number;
  profit: number;
  profitMarginPercentage: number;
  quantity: number;
  finalUnitPrice: number;
  finalTotalPrice: number;
  currency: 'EGP';
  customVariablesEvaluated: Record<string, { value: number | boolean; unit: PricingUnit; formatted: string }>;
  components: PricingBreakdownComponent[];
  constantsUsed: Record<string, { value: number; unit: PricingUnit }>;
}

export interface PricingEvaluationResult {
  totalPrice: number;
  unitPrice: number;
  currency: 'EGP';
  breakdown: PricingBreakdownResult;
  equationVersionId?: string;
  equationVersion?: number;
}
