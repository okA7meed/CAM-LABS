/**
 * Pricing Administration Service
 *
 * Manages pricing equations, versions, custom variables, constants,
 * testing sandbox, comparison, and publishing lifecycle.
 * Supports PostgreSQL with seamless in-memory fallback when database is not connected.
 */

import { getPrismaClient } from '../config/database';
import { Prisma } from '@prisma/client';
import {
  AstNode,
  CustomVariableDefinition,
  PricingConstantDefinition,
  ModelVariablesContext,
  PricingEvaluationResult,
} from './pricing-ast.types';
import { PricingEngineService } from './pricing-engine.service';
import { Logger } from '../utils/logger';

export interface DefaultTechTemplate {
  technology: string;
  name: string;
  description: string;
  constants: PricingConstantDefinition[];
  customVariables: CustomVariableDefinition[];
  formulaTree: AstNode;
}

export const DEFAULT_FDM_TEMPLATE: DefaultTechTemplate = {
  technology: 'FDM',
  name: 'FDM Additive Manufacturing Pricing',
  description: 'Authoritative pricing equation for Fused Deposition Modeling (FDM) 3D printing.',
  constants: [
    {
      key: 'PLA_PRICE',
      name: 'PLA Material Price',
      value: 2,
      unit: 'EGP/g',
      description: 'PLA material rate per gram',
      technology: 'FDM',
    },
    {
      key: 'MACHINE_HOURLY_RATE',
      name: 'Machine Hourly Rate',
      value: 50,
      unit: 'EGP/hour',
      description: 'Machine operational rate per hour',
      technology: 'FDM',
    },
    {
      key: 'PROFIT_MARGIN',
      name: 'Profit Margin',
      value: 0.20, // 20%
      unit: 'percentage',
      description: 'Profit margin markup applied to manufacturing cost',
      technology: 'FDM',
    },
  ],
  customVariables: [
    {
      code: 'Weight',
      name: 'Weight',
      description: 'Calculated part mass (Density × Volume)',
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
    {
      code: 'MaterialCost',
      name: 'Material Cost',
      description: 'Material cost (Weight × PLA Price)',
      unit: 'EGP',
      dataType: 'number',
      formulaTree: {
        type: 'BINARY_OP',
        operator: '*',
        left: { type: 'VARIABLE', name: 'Weight' },
        right: { type: 'CONSTANT', name: 'PLA_PRICE' },
      },
      dependencies: ['Weight'],
      isEnabled: true,
    },
    {
      code: 'MachineCost',
      name: 'Machine Cost',
      description: 'Machine cost (Machine Time × Machine Hourly Rate)',
      unit: 'EGP',
      dataType: 'number',
      formulaTree: {
        type: 'BINARY_OP',
        operator: '*',
        left: { type: 'VARIABLE', name: 'MachineTime' },
        right: { type: 'CONSTANT', name: 'MACHINE_HOURLY_RATE' },
      },
      dependencies: ['MachineTime'],
      isEnabled: true,
    },
    {
      code: 'BaseCost',
      name: 'Base Manufacturing Cost',
      description: 'Base cost before profit (Material Cost + Machine Cost)',
      unit: 'EGP',
      dataType: 'number',
      formulaTree: {
        type: 'BINARY_OP',
        operator: '+',
        left: { type: 'VARIABLE', name: 'MaterialCost' },
        right: { type: 'VARIABLE', name: 'MachineCost' },
      },
      dependencies: ['MaterialCost', 'MachineCost'],
      isEnabled: true,
    },
    {
      code: 'Profit',
      name: 'Profit Markup',
      description: 'Profit markup (Base Cost × Profit Margin)',
      unit: 'EGP',
      dataType: 'number',
      formulaTree: {
        type: 'BINARY_OP',
        operator: '*',
        left: { type: 'VARIABLE', name: 'BaseCost' },
        right: { type: 'CONSTANT', name: 'PROFIT_MARGIN' },
      },
      dependencies: ['BaseCost'],
      isEnabled: true,
    },
  ],
  formulaTree: {
    type: 'BINARY_OP',
    operator: '+',
    left: { type: 'VARIABLE', name: 'BaseCost' },
    right: { type: 'VARIABLE', name: 'Profit' },
  },
};

export const OTHER_TECH_TEMPLATES: DefaultTechTemplate[] = [
  {
    technology: 'SLA',
    name: 'SLA Stereolithography Pricing',
    description: 'Configurable equation for SLA resin 3D printing.',
    constants: [
      { key: 'RESIN_PRICE', name: 'Resin Price', value: 0, unit: 'EGP/g', description: 'Configurable resin rate per gram', technology: 'SLA' },
      { key: 'SLA_MACHINE_HOURLY_RATE', name: 'SLA Machine Hourly Rate', value: 0, unit: 'EGP/hour', description: 'SLA machine operational rate', technology: 'SLA' },
      { key: 'PROFIT_MARGIN', name: 'Profit Margin', value: 0.20, unit: 'percentage', description: 'Profit margin', technology: 'SLA' },
    ],
    customVariables: [
      {
        code: 'Weight',
        name: 'Weight',
        unit: 'g',
        dataType: 'number',
        formulaTree: { type: 'BINARY_OP', operator: '*', left: { type: 'VARIABLE', name: 'Density' }, right: { type: 'VARIABLE', name: 'Volume' } },
        dependencies: ['Density', 'Volume'],
        isEnabled: true,
      },
    ],
    formulaTree: {
      type: 'BINARY_OP',
      operator: '+',
      left: {
        type: 'BINARY_OP',
        operator: '*',
        left: { type: 'VARIABLE', name: 'Weight' },
        right: { type: 'CONSTANT', name: 'RESIN_PRICE' },
      },
      right: {
        type: 'BINARY_OP',
        operator: '*',
        left: { type: 'VARIABLE', name: 'MachineTime' },
        right: { type: 'CONSTANT', name: 'SLA_MACHINE_HOURLY_RATE' },
      },
    },
  },
  {
    technology: 'SLS',
    name: 'SLS Selective Laser Sintering Pricing',
    description: 'Configurable equation for SLS powder 3D printing.',
    constants: [
      { key: 'POWDER_PRICE', name: 'Powder Price', value: 0, unit: 'EGP/g', description: 'Configurable powder rate', technology: 'SLS' },
      { key: 'SLS_MACHINE_HOURLY_RATE', name: 'SLS Machine Hourly Rate', value: 0, unit: 'EGP/hour', description: 'SLS machine operational rate', technology: 'SLS' },
      { key: 'PROFIT_MARGIN', name: 'Profit Margin', value: 0.20, unit: 'percentage', description: 'Profit margin', technology: 'SLS' },
    ],
    customVariables: [],
    formulaTree: {
      type: 'BINARY_OP',
      operator: '*',
      left: { type: 'VARIABLE', name: 'Volume' },
      right: { type: 'CONSTANT', name: 'POWDER_PRICE' },
    },
  },
  {
    technology: 'CNC_MILLING',
    name: 'CNC Milling Pricing',
    description: 'Configurable equation for CNC Milling machining operations.',
    constants: [
      { key: 'STOCK_MATERIAL_PRICE', name: 'Stock Material Price', value: 0, unit: 'EGP/kg', description: 'Stock material price', technology: 'CNC_MILLING' },
      { key: 'CNC_MACHINE_HOURLY_RATE', name: 'CNC Machine Hourly Rate', value: 0, unit: 'EGP/hour', description: 'CNC machine operational rate', technology: 'CNC_MILLING' },
      { key: 'PROFIT_MARGIN', name: 'Profit Margin', value: 0.20, unit: 'percentage', description: 'Profit margin', technology: 'CNC_MILLING' },
    ],
    customVariables: [],
    formulaTree: {
      type: 'BINARY_OP',
      operator: '*',
      left: { type: 'VARIABLE', name: 'BoundingBoxVolume' },
      right: { type: 'CONSTANT', name: 'STOCK_MATERIAL_PRICE' },
    },
  },
  {
    technology: 'CNC_TURNING',
    name: 'CNC Turning Pricing',
    description: 'Configurable equation for CNC Turning lathe operations.',
    constants: [
      { key: 'BAR_STOCK_PRICE', name: 'Bar Stock Price', value: 0, unit: 'EGP/kg', description: 'Bar stock price', technology: 'CNC_TURNING' },
      { key: 'LATHE_MACHINE_HOURLY_RATE', name: 'Lathe Machine Hourly Rate', value: 0, unit: 'EGP/hour', description: 'Lathe machine operational rate', technology: 'CNC_TURNING' },
      { key: 'PROFIT_MARGIN', name: 'Profit Margin', value: 0.20, unit: 'percentage', description: 'Profit margin', technology: 'CNC_TURNING' },
    ],
    customVariables: [],
    formulaTree: {
      type: 'BINARY_OP',
      operator: '*',
      left: { type: 'VARIABLE', name: 'BoundingBoxVolume' },
      right: { type: 'CONSTANT', name: 'BAR_STOCK_PRICE' },
    },
  },
  {
    technology: 'LASER_CUTTING',
    name: 'Laser Cutting Pricing',
    description: 'Configurable equation for sheet metal and flat laser cutting.',
    constants: [
      { key: 'SHEET_AREA_PRICE', name: 'Sheet Area Price', value: 0, unit: 'EGP/cm2', description: 'Sheet area rate', technology: 'LASER_CUTTING' },
      { key: 'LASER_CUT_HOURLY_RATE', name: 'Laser Cut Hourly Rate', value: 0, unit: 'EGP/hour', description: 'Laser machine operational rate', technology: 'LASER_CUTTING' },
      { key: 'PROFIT_MARGIN', name: 'Profit Margin', value: 0.20, unit: 'percentage', description: 'Profit margin', technology: 'LASER_CUTTING' },
    ],
    customVariables: [],
    formulaTree: {
      type: 'BINARY_OP',
      operator: '*',
      left: { type: 'VARIABLE', name: 'SurfaceArea' },
      right: { type: 'CONSTANT', name: 'SHEET_AREA_PRICE' },
    },
  },
];

// In-memory fallback structures
interface InMemoryEquationVersion {
  id: string;
  equationId: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  name?: string;
  description?: string;
  formulaTree: AstNode;
  customVariables: CustomVariableDefinition[];
  constantsSnapshot?: Record<string, { value: number; unit: string; description?: string }>;
  publishedAt?: Date;
  publishedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface InMemoryEquation {
  id: string;
  technology: string;
  name: string;
  description?: string;
  currentPublishedId?: string;
  draftVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
  versions: InMemoryEquationVersion[];
}

const memoryEquations = new Map<string, InMemoryEquation>();
const memoryConstants = new Map<string, PricingConstantDefinition>();
const memoryPublications: any[] = [];
const memoryTests: any[] = [];
let memoryInitialized = false;

function initMemoryStore() {
  if (memoryInitialized) return;
  const allTemplates = [DEFAULT_FDM_TEMPLATE, ...OTHER_TECH_TEMPLATES];

  for (const tpl of allTemplates) {
    const eqId = `mem-eq-${tpl.technology.toLowerCase()}`;
    const v1Id = `mem-v1-${tpl.technology.toLowerCase()}`;
    const v2Id = `mem-v2-${tpl.technology.toLowerCase()}`;

    const constantsSnapshot: Record<string, { value: number; unit: string; description?: string }> = {};
    for (const c of tpl.constants) {
      constantsSnapshot[c.key] = { value: c.value, unit: c.unit, description: c.description };
      const memKey = c.technology ? `${c.technology}:${c.key}` : c.key;
      memoryConstants.set(memKey, { ...c });
    }

    const v1: InMemoryEquationVersion = {
      id: v1Id,
      equationId: eqId,
      version: 1,
      status: 'PUBLISHED',
      name: `${tpl.name} v1 (Initial Published)`,
      description: 'Default initial published version',
      formulaTree: tpl.formulaTree,
      customVariables: tpl.customVariables,
      constantsSnapshot,
      publishedAt: new Date(),
      publishedBy: 'SYSTEM_BOOTSTRAP',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const v2: InMemoryEquationVersion = {
      id: v2Id,
      equationId: eqId,
      version: 2,
      status: 'DRAFT',
      name: `${tpl.name} v2 (Draft)`,
      description: 'Active editable draft',
      formulaTree: tpl.formulaTree,
      customVariables: tpl.customVariables,
      constantsSnapshot,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const eq: InMemoryEquation = {
      id: eqId,
      technology: tpl.technology,
      name: tpl.name,
      description: tpl.description,
      currentPublishedId: v1Id,
      draftVersionId: v2Id,
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [v1, v2],
    };

    memoryEquations.set(tpl.technology, eq);
  }

  memoryInitialized = true;
}

export class PricingAdminService {
  /**
   * Ensure standard templates and equations are initialized
   */
  static async ensureInitialized(): Promise<void> {
    initMemoryStore();

    try {
      const prisma = getPrismaClient();
      const allTemplates = [DEFAULT_FDM_TEMPLATE, ...OTHER_TECH_TEMPLATES];

      for (const tpl of allTemplates) {
        let equation = await prisma.pricingEquation.findUnique({
          where: { technology: tpl.technology },
          include: { versions: true },
        });

        if (!equation) {
          Logger.info(`[PricingAdminService] Initializing default equation for ${tpl.technology}`);

          equation = await prisma.pricingEquation.create({
            data: {
              technology: tpl.technology,
              name: tpl.name,
              description: tpl.description,
            },
            include: { versions: true },
          });
        }

        // Ensure constants exist in database
        for (const c of tpl.constants) {
          await prisma.pricingConstant.upsert({
            where: { key: c.key },
            update: {},
            create: {
              key: c.key,
              name: c.name,
              value: c.value,
              unit: c.unit,
              description: c.description,
              technology: c.technology,
            },
          });
        }

        // Ensure published version (v1) exists
        const published = equation.versions.find((v) => v.status === 'PUBLISHED');
        if (!published) {
          const constantsSnapshot: Record<string, { value: number; unit: string; description?: string }> = {};
          for (const c of tpl.constants) {
            constantsSnapshot[c.key] = { value: c.value, unit: c.unit, description: c.description };
          }

          const v1 = await prisma.pricingEquationVersion.create({
            data: {
              equationId: equation.id,
              version: 1,
              status: 'PUBLISHED',
              name: `${tpl.name} v1 (Initial Published)`,
              description: 'Default initial published version',
              formulaTree: tpl.formulaTree as unknown as Prisma.InputJsonValue,
              customVariables: tpl.customVariables as unknown as Prisma.InputJsonValue,
              constantsSnapshot: constantsSnapshot as unknown as Prisma.InputJsonValue,
              publishedAt: new Date(),
              publishedBy: 'SYSTEM_BOOTSTRAP',
            },
          });

          // Also create a draft version (v2 draft for editing)
          const draft = await prisma.pricingEquationVersion.create({
            data: {
              equationId: equation.id,
              version: 2,
              status: 'DRAFT',
              name: `${tpl.name} v2 (Draft)`,
              description: 'Active editable draft',
              formulaTree: tpl.formulaTree as unknown as Prisma.InputJsonValue,
              customVariables: tpl.customVariables as unknown as Prisma.InputJsonValue,
              constantsSnapshot: constantsSnapshot as unknown as Prisma.InputJsonValue,
            },
          });

          await prisma.pricingEquation.update({
            where: { id: equation.id },
            data: {
              currentPublishedId: v1.id,
              draftVersionId: draft.id,
            },
          });

          // Create publication record
          await prisma.pricingPublication.create({
            data: {
              equationId: equation.id,
              versionId: v1.id,
              publishedBy: 'SYSTEM_BOOTSTRAP',
              notes: 'Initial authoritative equation baseline',
              snapshot: {
                formulaTree: tpl.formulaTree,
                customVariables: tpl.customVariables,
                constants: constantsSnapshot,
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        Logger.error(`[PricingAdminService] FATAL: pricing initialization requires PostgreSQL in production: ${err.message}`);
        throw err;
      }
      Logger.warn(`[PricingAdminService] Prisma DB initialization fallback to in-memory: ${err.message}`);
    }
  }

  /**
   * Get all pricing equations with active published and draft versions
   */
  static async getAllEquations() {
    await this.ensureInitialized();
    try {
      const prisma = getPrismaClient();
      const equations = await prisma.pricingEquation.findMany({
        include: {
          versions: {
            orderBy: { version: 'desc' },
          },
        },
        orderBy: { technology: 'asc' },
      });

      if (equations.length > 0) {
        return equations.map((eq) => {
          const published = eq.versions.find((v) => v.id === eq.currentPublishedId) || eq.versions.find((v) => v.status === 'PUBLISHED');
          const draft = eq.versions.find((v) => v.id === eq.draftVersionId) || eq.versions.find((v) => v.status === 'DRAFT');

          return {
            id: eq.id,
            technology: eq.technology,
            name: eq.name,
            description: eq.description,
            currentPublishedVersion: published ? {
              id: published.id,
              version: published.version,
              name: published.name,
              publishedAt: published.publishedAt,
              publishedBy: published.publishedBy,
              formulaTree: published.formulaTree,
              customVariables: published.customVariables,
              constantsSnapshot: published.constantsSnapshot,
            } : null,
            draftVersion: draft ? {
              id: draft.id,
              version: draft.version,
              name: draft.name,
              updatedAt: draft.updatedAt,
              formulaTree: draft.formulaTree,
              customVariables: draft.customVariables,
              constantsSnapshot: draft.constantsSnapshot,
            } : null,
            totalVersionsCount: eq.versions.length,
          };
        });
      }
    } catch {
      // Fallback to in-memory
    }

    // In-memory format
    return Array.from(memoryEquations.values()).map((eq) => {
      const published = eq.versions.find((v) => v.id === eq.currentPublishedId) || eq.versions.find((v) => v.status === 'PUBLISHED');
      const draft = eq.versions.find((v) => v.id === eq.draftVersionId) || eq.versions.find((v) => v.status === 'DRAFT');
      return {
        id: eq.id,
        technology: eq.technology,
        name: eq.name,
        description: eq.description,
        currentPublishedVersion: published ? {
          id: published.id,
          version: published.version,
          name: published.name,
          publishedAt: published.publishedAt,
          publishedBy: published.publishedBy,
          formulaTree: published.formulaTree,
          customVariables: published.customVariables,
          constantsSnapshot: published.constantsSnapshot,
        } : null,
        draftVersion: draft ? {
          id: draft.id,
          version: draft.version,
          name: draft.name,
          updatedAt: draft.updatedAt,
          formulaTree: draft.formulaTree,
          customVariables: draft.customVariables,
          constantsSnapshot: draft.constantsSnapshot,
        } : null,
        totalVersionsCount: eq.versions.length,
      };
    });
  }

  /**
   * Get equation details by technology
   */
  static async getEquationByTechnology(technology: string) {
    await this.ensureInitialized();
    const normTech = technology.toUpperCase().replace(/\s+/g, '_');

    try {
      const prisma = getPrismaClient();
      const equation = await prisma.pricingEquation.findUnique({
        where: { technology: normTech },
        include: {
          versions: { orderBy: { version: 'desc' } },
        },
      });

      if (equation) {
        const published = equation.versions.find((v) => v.id === equation.currentPublishedId) || equation.versions.find((v) => v.status === 'PUBLISHED');
        const draft = equation.versions.find((v) => v.id === equation.draftVersionId) || equation.versions.find((v) => v.status === 'DRAFT');

        const constants = await prisma.pricingConstant.findMany({
          where: {
            OR: [{ technology: normTech }, { technology: null }],
          },
          orderBy: { key: 'asc' },
        });

        return {
          equation,
          publishedVersion: published,
          draftVersion: draft,
          constants,
          predefinedVariables: this.getPredefinedVariables(),
          versions: equation.versions,
        };
      }
    } catch {
      // Fallback
    }

    const memEq = memoryEquations.get(normTech);
    if (!memEq) {
      throw new Error(`Pricing equation for technology '${technology}' not found.`);
    }

    const published = memEq.versions.find((v) => v.id === memEq.currentPublishedId) || memEq.versions.find((v) => v.status === 'PUBLISHED');
    const draft = memEq.versions.find((v) => v.id === memEq.draftVersionId) || memEq.versions.find((v) => v.status === 'DRAFT');

    const constants = Array.from(memoryConstants.values()).filter(
      (c) => !c.technology || c.technology === normTech
    );

    return {
      equation: memEq,
      publishedVersion: published,
      draftVersion: draft,
      constants,
      predefinedVariables: this.getPredefinedVariables(),
      versions: memEq.versions,
    };
  }

  private static getPredefinedVariables() {
    return [
      { code: 'Width', name: 'Part Width', unit: 'mm', description: 'CAD bounding width', type: 'PREDEFINED' },
      { code: 'Height', name: 'Part Height', unit: 'mm', description: 'CAD bounding height', type: 'PREDEFINED' },
      { code: 'Depth', name: 'Part Depth', unit: 'mm', description: 'CAD bounding depth', type: 'PREDEFINED' },
      { code: 'Volume', name: 'Part Volume', unit: 'cm3', description: 'Analyzed solid volume in cubic centimeters', type: 'PREDEFINED' },
      { code: 'BoundingBoxVolume', name: 'Bounding Box Volume', unit: 'cm3', description: 'Overall bounding box volume', type: 'PREDEFINED' },
      { code: 'ConvexHullVolume', name: 'Convex Hull Volume', unit: 'cm3', description: 'Convex hull volume', type: 'PREDEFINED' },
      { code: 'SurfaceArea', name: 'Surface Area', unit: 'cm2', description: 'CAD surface area', type: 'PREDEFINED' },
      { code: 'Infill', name: 'Infill Percentage', unit: 'percentage', description: 'Internal infill ratio (e.g. 20%)', type: 'PREDEFINED' },
      { code: 'LayerHeight', name: 'Layer Height', unit: 'mm', description: 'Slicing layer height', type: 'PREDEFINED' },
      { code: 'ShellThickness', name: 'Shell Thickness', unit: 'mm', description: 'Wall / perimeter thickness', type: 'PREDEFINED' },
      { code: 'Quantity', name: 'Part Quantity', unit: 'unitless', description: 'Number of units requested', type: 'PREDEFINED' },
      { code: 'Density', name: 'Material Density', unit: 'g/cm3', description: 'Selected material density', type: 'PREDEFINED' },
      { code: 'MachineTime', name: 'Machine Time', unit: 'hour', description: 'Estimated print / machine operation time', type: 'PREDEFINED' },
    ];
  }

  /**
   * Save draft equation and custom variables
   */
  static async saveDraft(params: {
    technology: string;
    formulaTree: AstNode;
    customVariables: CustomVariableDefinition[];
    constantsSnapshot?: Record<string, { value: number; unit: string }>;
    name?: string;
    description?: string;
  }) {
    await this.ensureInitialized();
    const normTech = params.technology.toUpperCase().replace(/\s+/g, '_');

    // Validate custom variables and check circular dependencies
    PricingEngineService.validateDependencies(params.customVariables || []);

    try {
      const prisma = getPrismaClient();
      const equation = await prisma.pricingEquation.findUnique({
        where: { technology: normTech },
        include: { versions: true },
      });

      if (equation) {
        let draft = equation.versions.find((v) => v.id === equation.draftVersionId) || equation.versions.find((v) => v.status === 'DRAFT');

        if (!draft) {
          const highestVersion = Math.max(0, ...equation.versions.map((v) => v.version));
          draft = await prisma.pricingEquationVersion.create({
            data: {
              equationId: equation.id,
              version: highestVersion + 1,
              status: 'DRAFT',
              name: params.name || `${equation.name} Draft`,
              description: params.description || 'Draft equation',
              formulaTree: params.formulaTree as unknown as Prisma.InputJsonValue,
              customVariables: (params.customVariables || []) as unknown as Prisma.InputJsonValue,
              constantsSnapshot: (params.constantsSnapshot || {}) as unknown as Prisma.InputJsonValue,
            },
          });

          await prisma.pricingEquation.update({
            where: { id: equation.id },
            data: { draftVersionId: draft.id },
          });
        } else {
          draft = await prisma.pricingEquationVersion.update({
            where: { id: draft.id },
            data: {
              formulaTree: params.formulaTree as unknown as Prisma.InputJsonValue,
              customVariables: (params.customVariables || []) as unknown as Prisma.InputJsonValue,
              constantsSnapshot: params.constantsSnapshot ? (params.constantsSnapshot as unknown as Prisma.InputJsonValue) : undefined,
              name: params.name || draft.name,
              description: params.description || draft.description,
              updatedAt: new Date(),
            },
          });
        }

        return draft;
      }
    } catch {
      // In-memory fallback
    }

    const memEq = memoryEquations.get(normTech);
    if (!memEq) throw new Error(`Equation for technology '${params.technology}' does not exist.`);

    let memDraft = memEq.versions.find((v) => v.id === memEq.draftVersionId) || memEq.versions.find((v) => v.status === 'DRAFT');
    if (!memDraft) {
      const highestVersion = Math.max(0, ...memEq.versions.map((v) => v.version));
      memDraft = {
        id: `mem-v${highestVersion + 1}-${normTech.toLowerCase()}`,
        equationId: memEq.id,
        version: highestVersion + 1,
        status: 'DRAFT',
        name: params.name || `${memEq.name} Draft`,
        description: params.description || 'Draft equation',
        formulaTree: params.formulaTree,
        customVariables: params.customVariables || [],
        constantsSnapshot: params.constantsSnapshot as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memEq.versions.unshift(memDraft);
      memEq.draftVersionId = memDraft.id;
    } else {
      memDraft.formulaTree = params.formulaTree;
      memDraft.customVariables = params.customVariables || [];
      if (params.constantsSnapshot) memDraft.constantsSnapshot = params.constantsSnapshot as any;
      memDraft.updatedAt = new Date();
    }

    return memDraft;
  }

  /**
   * Test equation calculation
   */
  static async testEquation(params: {
    technology: string;
    isDraft?: boolean;
    modelContext: ModelVariablesContext;
    customVariablesOverride?: CustomVariableDefinition[];
    formulaTreeOverride?: AstNode;
    constantsOverride?: Record<string, { value: number; unit: any }>;
  }): Promise<PricingEvaluationResult> {
    await this.ensureInitialized();
    const details = await this.getEquationByTechnology(params.technology);
    const targetVersion = params.isDraft ? details.draftVersion : details.publishedVersion;

    if (!targetVersion && !params.formulaTreeOverride) {
      throw new Error(`No equation version available for testing in ${params.technology}.`);
    }

    const formulaTree = params.formulaTreeOverride || (targetVersion?.formulaTree as unknown as AstNode);
    const customVariables = params.customVariablesOverride || (targetVersion?.customVariables as unknown as CustomVariableDefinition[]) || [];

    const dbConstants = details.constants;
    const constantsMap: Record<string, { value: number; unit: any }> = {};
    for (const c of dbConstants) {
      constantsMap[c.key] = { value: c.value, unit: c.unit };
    }
    if (params.constantsOverride) {
      Object.assign(constantsMap, params.constantsOverride);
    }

    return PricingEngineService.calculatePricing({
      modelContext: params.modelContext,
      customVariables,
      constants: constantsMap,
      equationTree: formulaTree,
      equationVersionId: targetVersion?.id,
      equationVersion: targetVersion?.version,
    });
  }

  /**
   * Compare Draft vs Published equation
   */
  static async compareDraftVsPublished(params: {
    technology: string;
    modelContext: ModelVariablesContext;
    draftFormulaOverride?: AstNode;
    draftCustomVariablesOverride?: CustomVariableDefinition[];
  }) {
    await this.ensureInitialized();
    const details = await this.getEquationByTechnology(params.technology);

    if (!details.publishedVersion) throw new Error('No published equation version found to compare against.');
    if (!details.draftVersion && !params.draftFormulaOverride) throw new Error('No draft equation version found to compare.');

    const publishedTree = details.publishedVersion.formulaTree as unknown as AstNode;
    const publishedCustomVars = (details.publishedVersion.customVariables as unknown as CustomVariableDefinition[]) || [];

    const draftTree = params.draftFormulaOverride || (details.draftVersion?.formulaTree as unknown as AstNode);
    const draftCustomVars = params.draftCustomVariablesOverride || (details.draftVersion?.customVariables as unknown as CustomVariableDefinition[]) || [];

    const constantsMap: Record<string, { value: number; unit: any }> = {};
    for (const c of details.constants) {
      constantsMap[c.key] = { value: c.value, unit: c.unit };
    }

    const comparison = PricingEngineService.compareEquations({
      modelContext: params.modelContext,
      publishedEquation: {
        tree: publishedTree,
        customVariables: publishedCustomVars,
        constants: constantsMap,
        version: details.publishedVersion.version,
        versionId: details.publishedVersion.id,
      },
      draftEquation: {
        tree: draftTree,
        customVariables: draftCustomVars,
        constants: constantsMap,
        version: details.draftVersion?.version,
        versionId: details.draftVersion?.id,
      },
    });

    try {
      const prisma = getPrismaClient();
      await prisma.pricingTest.create({
        data: {
          equationId: details.equation.id,
          technology: details.equation.technology,
          inputParams: params.modelContext as unknown as Prisma.InputJsonValue,
          publishedResult: comparison.publishedResult as unknown as Prisma.InputJsonValue,
          draftResult: comparison.draftResult as unknown as Prisma.InputJsonValue,
          comparison: {
            previousPrice: comparison.previousPrice,
            newPrice: comparison.newPrice,
            differenceEgp: comparison.differenceEgp,
            percentDifference: comparison.percentDifference,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch {
      memoryTests.push({
        equationId: details.equation.id,
        technology: details.equation.technology,
        inputParams: params.modelContext,
        comparison,
        createdAt: new Date(),
      });
    }

    return comparison;
  }

  /**
   * Publish Draft equation
   */
  static async publishDraft(params: {
    technology: string;
    publishedBy: string;
    notes?: string;
  }) {
    await this.ensureInitialized();
    const normTech = params.technology.toUpperCase().replace(/\s+/g, '_');
    const details = await this.getEquationByTechnology(params.technology);

    const draft = details.draftVersion;
    if (!draft) throw new Error('No draft equation version found to publish.');

    const constants = details.constants;
    const constantsSnapshot: Record<string, { value: number; unit: string; description?: string }> = {};
    for (const c of constants) {
      constantsSnapshot[c.key] = { value: c.value, unit: c.unit, description: c.description || undefined };
    }

    const highestVersion = Math.max(0, ...details.versions.map((v: any) => v.version));
    const newVersionNumber = highestVersion + 1;

    try {
      const prisma = getPrismaClient();
      return await prisma.$transaction(async (tx) => {
        if (details.publishedVersion) {
          await tx.pricingEquationVersion.update({
            where: { id: details.publishedVersion.id },
            data: { status: 'ARCHIVED' },
          });
        }

        const publishedVersion = await tx.pricingEquationVersion.create({
          data: {
            equationId: details.equation.id,
            version: newVersionNumber,
            status: 'PUBLISHED',
            name: `${details.equation.name} v${newVersionNumber}`,
            description: params.notes || `Published version v${newVersionNumber}`,
            formulaTree: draft.formulaTree as unknown as Prisma.InputJsonValue,
            customVariables: draft.customVariables as unknown as Prisma.InputJsonValue,
            constantsSnapshot: constantsSnapshot as unknown as Prisma.InputJsonValue,
            publishedAt: new Date(),
            publishedBy: params.publishedBy,
          },
        });

        const nextDraftVersion = await tx.pricingEquationVersion.create({
          data: {
            equationId: details.equation.id,
            version: newVersionNumber + 1,
            status: 'DRAFT',
            name: `${details.equation.name} v${newVersionNumber + 1} (Draft)`,
            description: 'Editable draft',
            formulaTree: draft.formulaTree as unknown as Prisma.InputJsonValue,
            customVariables: draft.customVariables as unknown as Prisma.InputJsonValue,
            constantsSnapshot: constantsSnapshot as unknown as Prisma.InputJsonValue,
          },
        });

        if (draft.id !== publishedVersion.id) {
          await tx.pricingEquationVersion.update({
            where: { id: draft.id },
            data: { status: 'ARCHIVED' },
          });
        }

        await tx.pricingEquation.update({
          where: { id: details.equation.id },
          data: {
            currentPublishedId: publishedVersion.id,
            draftVersionId: nextDraftVersion.id,
            updatedAt: new Date(),
          },
        });

        const publication = await tx.pricingPublication.create({
          data: {
            equationId: details.equation.id,
            versionId: publishedVersion.id,
            publishedBy: params.publishedBy,
            notes: params.notes,
            snapshot: {
              formulaTree: draft.formulaTree,
              customVariables: draft.customVariables,
              constants: constantsSnapshot,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return { publishedVersion, nextDraftVersion, publication };
      });
    } catch {
      // In-memory publishing transaction
      const memEq = memoryEquations.get(normTech);
      if (!memEq) throw new Error(`Memory equation for ${normTech} not found.`);

      // Archive current published
      for (const v of memEq.versions) {
        if (v.status === 'PUBLISHED') v.status = 'ARCHIVED';
      }

      const publishedVersion: InMemoryEquationVersion = {
        id: `mem-v${newVersionNumber}-${normTech.toLowerCase()}`,
        equationId: memEq.id,
        version: newVersionNumber,
        status: 'PUBLISHED',
        name: `${memEq.name} v${newVersionNumber}`,
        description: params.notes || `Published version v${newVersionNumber}`,
        formulaTree: draft.formulaTree as any,
        customVariables: draft.customVariables as any,
        constantsSnapshot,
        publishedAt: new Date(),
        publishedBy: params.publishedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const nextDraftVersion: InMemoryEquationVersion = {
        id: `mem-v${newVersionNumber + 1}-${normTech.toLowerCase()}`,
        equationId: memEq.id,
        version: newVersionNumber + 1,
        status: 'DRAFT',
        name: `${memEq.name} v${newVersionNumber + 1} (Draft)`,
        description: 'Editable draft',
        formulaTree: draft.formulaTree as any,
        customVariables: draft.customVariables as any,
        constantsSnapshot,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      memEq.versions.unshift(nextDraftVersion);
      memEq.versions.unshift(publishedVersion);
      memEq.currentPublishedId = publishedVersion.id;
      memEq.draftVersionId = nextDraftVersion.id;

      const publication = {
        id: `mem-pub-${Date.now()}`,
        equationId: memEq.id,
        versionId: publishedVersion.id,
        publishedBy: params.publishedBy,
        notes: params.notes,
        publishedAt: new Date(),
        snapshot: {
          formulaTree: draft.formulaTree,
          customVariables: draft.customVariables,
          constants: constantsSnapshot,
        },
      };
      memoryPublications.push(publication);

      return { publishedVersion, nextDraftVersion, publication };
    }
  }

  /**
   * Upsert constant
   */
  static async upsertConstant(params: {
    key: string;
    name: string;
    value: number;
    unit: string;
    description?: string;
    technology?: string;
  }) {
    const memKey = params.technology ? `${params.technology}:${params.key}` : params.key;
    memoryConstants.set(memKey, {
      key: params.key,
      name: params.name,
      value: params.value,
      unit: params.unit as any,
      description: params.description,
      technology: params.technology,
    });

    try {
      const prisma = getPrismaClient();
      return await prisma.pricingConstant.upsert({
        where: { key: params.key },
        update: {
          name: params.name,
          value: params.value,
          unit: params.unit,
          description: params.description,
          technology: params.technology,
        },
        create: {
          key: params.key,
          name: params.name,
          value: params.value,
          unit: params.unit,
          description: params.description,
          technology: params.technology,
        },
      });
    } catch {
      return memoryConstants.get(params.key);
    }
  }

  /**
   * Get active published equation for technology
   */
  static async getActivePublishedEquation(technology: string) {
    await this.ensureInitialized();
    const normTech = technology.toUpperCase().replace(/\s+/g, '_');

    try {
      const prisma = getPrismaClient();
      const equation = await prisma.pricingEquation.findUnique({
        where: { technology: normTech },
        include: {
          versions: {
            where: { status: 'PUBLISHED' },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      });

      if (equation && equation.versions.length > 0) {
        const published = equation.versions[0];
        const constants = await prisma.pricingConstant.findMany({
          where: {
            OR: [{ technology: normTech }, { technology: null }],
          },
        });

        const constantsMap: Record<string, { value: number; unit: any }> = {};
        for (const c of constants) {
          constantsMap[c.key] = { value: c.value, unit: c.unit };
        }

        return {
          equation,
          version: published,
          formulaTree: published.formulaTree as unknown as AstNode,
          customVariables: (published.customVariables as unknown as CustomVariableDefinition[]) || [],
          constants: constantsMap,
        };
      }
    } catch {
      // Fallback
    }

    const memEq = memoryEquations.get(normTech);
    if (!memEq) {
      throw new Error(`No active published pricing equation found for technology: ${technology}`);
    }

    const published = memEq.versions.find((v) => v.id === memEq.currentPublishedId) || memEq.versions.find((v) => v.status === 'PUBLISHED');
    if (!published) {
      throw new Error(`No published version found in memory for ${technology}`);
    }

    const constantsMap: Record<string, { value: number; unit: any }> = {};
    for (const c of memoryConstants.values()) {
      if (!c.technology || c.technology === normTech) {
        constantsMap[c.key] = { value: c.value, unit: c.unit };
      }
    }

    return {
      equation: memEq,
      version: published,
      formulaTree: published.formulaTree,
      customVariables: published.customVariables,
      constants: constantsMap,
    };
  }
}
