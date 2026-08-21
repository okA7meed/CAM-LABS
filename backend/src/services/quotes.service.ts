import { getManufacturingEngine } from '../providers/manufacturing';
import { ManufacturingQuoteRequest } from '../providers/manufacturing/IManufacturingProvider';
import { MultiFileQuotationRequest, MultiFileQuotationResponse } from '../providers/manufacturing/IMultiFileProvider';
import { PricingService, NormalizedCustomerQuote } from './pricing.service';
import { Logger } from '../utils/logger';
import { getPrismaClient } from '../config/database';
import { Prisma, Quote } from '@prisma/client';
import { createObjectStorage } from '../cad/object-storage';

/**
 * Quotes Service
 *
 * Orchestrates the quotation flow through the CAM LABS manufacturing and pricing engines.
 */
export class QuotesService {
  private static readonly storage = createObjectStorage();
  private static async geometryForCadFile(fileId: string, owner?: { userId?: string; guestId?: string }) {
    const prisma = getPrismaClient();
    const ownerFilter = owner?.userId ? { userId: owner.userId } : owner?.guestId ? { userId: null, guestId: owner.guestId } : {};
    const file = await prisma.cadFile.findFirst({ where: { id: fileId, ...ownerFilter }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    const version = file?.versions[0];
    const metadata = version?.metadata as { geometryStatus?: string; supportLevel?: string; volume?: number; surfaceArea?: number; dimensions?: { width?: number; depth?: number; height?: number }; units?: string; unitsStatus?: string; triangleCount?: number } | null;
    if (!file || !version || version.processingStatus !== 'COMPLETE' || metadata?.geometryStatus !== 'READY' || metadata.supportLevel === 'FAILED_VALIDATION' || !metadata?.volume || !metadata.surfaceArea || !metadata.dimensions) {
      throw new Error(`Engineering analysis is unavailable for CAD file ${fileId}.`);
    }
    const configuredUnit = process.env.CAM_LABS_MESH_DEFAULT_UNIT;
    const unit = (version.detectedUnit && version.detectedUnit !== 'unknown' ? version.detectedUnit : metadata.units && metadata.units !== 'unitless' ? metadata.units : configuredUnit || '').toLowerCase();
    if (!unit) throw new Error(`Units are unavailable for CAD file ${fileId}.`);
    const toMm = unit === 'm' ? 1000 : unit === 'cm' ? 10 : unit === 'in' ? 25.4 : 1;
    const toCm3 = toMm ** 3 / 1000;
    return {
      modelData: await this.storage.read(version.storageKey),
      volumeCm3: metadata.volume * toCm3,
      surfaceAreaCm2: metadata.surfaceArea * toMm ** 2 / 100,
      dimensionsMm: { width: (metadata.dimensions.width || 0) * toMm, depth: (metadata.dimensions.depth || 0) * toMm, height: (metadata.dimensions.height || 0) * toMm },
      triangleCount: metadata.triangleCount,
      geometrySource: 'calculated' as const,
      geometryUnits: unit,
    };
  }

  /**
  * Request an instant quotation from the CAM LABS manufacturing engine.
   */
  static async calculateQuotation(
    request: ManufacturingQuoteRequest & { cadFileId?: string; cadOwner?: { userId?: string; guestId?: string } }
  ): Promise<NormalizedCustomerQuote> {
    Logger.info(
      `[QuotesService] Requesting CAM LABS manufacturing calculation for material: ${request.materialId}`
    );

    const engine = getManufacturingEngine();
    const geometry = request.cadFileId ? await this.geometryForCadFile(request.cadFileId, request.cadOwner) : undefined;
    if (!geometry) throw new Error('A persisted CAD file engineering analysis is required before pricing.');
    const rawQuote = await engine.calculateQuote({ ...request, ...geometry, volumeCm3: geometry.volumeCm3, surfaceAreaCm2: geometry.surfaceAreaCm2 });
    const normalizedQuote = PricingService.processManufacturingQuote(
      rawQuote,
      request.quantity
    );

    return normalizedQuote;
  }

  /**
   * Save a quotation to the user's dashboard records
   */
  static async saveQuotation(data: {
    userId?: string;
    partName: string;
    technology: string;
    material: string;
    quantity: number;
    toleranceGrade: string;
    surfaceFinish: string;
    cadFileIds?: string[];
    pricing: NormalizedCustomerQuote;
  }): Promise<Quote> {
    const prisma = getPrismaClient();
    const validUntilDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const newQuote = await prisma.quote.create({
      data: {
        id: `RFQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: data.userId,
        partName: data.partName,
        technology: data.technology,
        material: data.material,
        quantity: data.quantity,
        toleranceGrade: data.toleranceGrade,
        surfaceFinish: data.surfaceFinish,
        manufacturingCost: data.pricing.formattedManufacturingCost,
        unitPrice: data.pricing.formattedUnitPrice,
        totalPrice: data.pricing.formattedTotalPrice,
        leadTime: data.pricing.leadTime,
        validUntil: validUntilDate,
        status: 'Ready for Approval',
        provider: 'CAM LABS',
        providerQuoteRef: data.pricing.quoteRef,
        cadFileIds: data.cadFileIds,
        pricingBreakdown: data.pricing.pricingBreakdown as unknown as Prisma.InputJsonValue,
      },
    });

    Logger.info(`[QuotesService] Saved quotation record to database: ${newQuote.id}`);

    return newQuote;
  }

  static async saveMultiFileQuotation(data: {
    userId?: string;
    partName: string;
    technology: string;
    material: string;
    quantity: number;
    toleranceGrade: string;
    surfaceFinish: string;
    cadFileIds?: string[];
    pricing: MultiFileQuotationResponse;
  }): Promise<Quote> {
    const prisma = getPrismaClient();
    return prisma.quote.create({
      data: {
        id: `RFQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: data.userId,
        partName: data.partName,
        technology: data.technology,
        material: data.material,
        quantity: data.quantity,
        toleranceGrade: data.toleranceGrade,
        surfaceFinish: data.surfaceFinish,
        manufacturingCost: data.pricing.formattedManufacturingSubtotal,
        unitPrice: `${(data.pricing.totalCustomerPrice / Math.max(1, data.quantity)).toFixed(2)} EGP`,
        totalPrice: data.pricing.formattedTotalPrice,
        leadTime: data.pricing.leadTime,
        validUntil: data.pricing.expiresAt,
        status: 'Ready for Approval',
        provider: 'CAM LABS',
        providerQuoteRef: data.pricing.quoteId,
        cadFileIds: data.cadFileIds,
        pricingBreakdown: data.pricing.pricingBreakdown as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Get all quotations
   */
  static async getAllQuotes(userId?: string): Promise<Quote[]> {
    const prisma = getPrismaClient();
    if (userId) {
      return prisma.quote.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    }
    return prisma.quote.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /**
   * Find quote by ID
   */
  static async getQuoteById(id: string): Promise<Quote | null> {
    const prisma = getPrismaClient();
    return prisma.quote.findUnique({ where: { id } });
  }

  /**
   * Calculate multi-file quotation
   * 
   * NEW METHOD for Phase 04: Supports multiple files with individual configurations
   * Uses native CAM LABS pricing calculations (not provider-dependent)
   */
  static async calculateMultiFileQuotation(
    request: MultiFileQuotationRequest
  ): Promise<MultiFileQuotationResponse> {
    Logger.info(
      `[QuotesService] Calculating multi-file quotation for ${request.files.length} file(s)`
    );

    if (!request.files || request.files.length === 0) {
      throw new Error('At least one file is required for quotation');
    }

    const engine = getManufacturingEngine();
    const manufacturingQuotes = await Promise.all(request.files.map(async (file) => engine.calculateQuote({
      materialId: file.materialId,
      technology: file.technology,
      surfaceFinish: file.surfaceFinish,
      toleranceGrade: file.toleranceGrade,
      quantity: file.quantity,
      ...(await this.geometryForCadFile(file.fileId, request.cadOwner)),
      manufacturingParameters: file.manufacturingParameters,
      fileName: file.fileName,
    })));
    const quotation = PricingService.calculateMultiFileQuotation(request.files, manufacturingQuotes);

    Logger.info(
      `[QuotesService] Multi-file quotation calculated: ${quotation.files.length} files, ` +
      `Total: ${quotation.totalCustomerPrice} EGP`
    );

    return quotation;
  }
}
