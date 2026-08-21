import { getManufacturingEngine } from '../providers/manufacturing';
import { Logger } from '../utils/logger';
import { QuotesService } from './quotes.service';
import { getPrismaClient } from '../config/database';
import { Order, Prisma } from '@prisma/client';

/**
 * Orders Service
 *
 * Manages order lifecycle, status milestones, and dispatches orders to CAM LABS internal manufacturing.
 */
export class OrdersService {
  /**
   * Validate that a quote is still valid (not expired)
   * 
   * NEW (Phase 04): Prevents orders from being created with expired quotes
   */
  static async validateQuoteValidity(quoteId?: string | null): Promise<boolean> {
    if (!quoteId) return true; // Quote ID is optional

    try {
      const prisma = getPrismaClient();
      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });

      if (!quote) {
        Logger.warn(`[OrdersService] Quote not found: ${quoteId}`);
        return false;
      }

      const expirationDate = new Date(quote.validUntil);
      const now = new Date();

      if (now > expirationDate) {
        Logger.warn(`[OrdersService] Quote ${quoteId} has expired (was valid until ${quote.validUntil})`);
        return false;
      }

      Logger.debug(`[OrdersService] Quote ${quoteId} is still valid (expires ${quote.validUntil})`);
      return true;
    } catch (err: any) {
      Logger.error(`[OrdersService] Error validating quote: ${err.message}`);
      return false;
    }
  }

  /**
   * Create and dispatch a new manufacturing order
   */
  static async createOrder(
    orderData: Partial<Order> & { surfaceFinish?: string; cadFileIds?: string[]; cadFileConfigs?: Array<{ cadFileId: string; configuration?: Record<string, unknown>; totalCost?: string }>; guestCadId?: string }
  ): Promise<Order> {
    const prisma = getPrismaClient();

    // NEW (Phase 04): Validate quote is not expired
    if (!orderData.quoteId) throw new Error('A valid quote is required before an order can be submitted.');
    const quote = await prisma.quote.findUnique({ where: { id: orderData.quoteId } });
    if (!quote || (quote.userId && quote.userId !== orderData.userId)) throw new Error('Quote is invalid or does not belong to this customer.');
    if (!(await this.validateQuoteValidity(orderData.quoteId))) {
      throw new Error(`Quote ${orderData.quoteId} has expired or is invalid. Please request a fresh quotation.`);
    }
    if (quote.technology !== (orderData.technology || '') || quote.material !== (orderData.material || '') || quote.quantity !== (orderData.quantity || 1)) {
      throw new Error('The submitted manufacturing configuration does not match the quoted configuration.');
    }

    const cadFileIds = [...new Set(orderData.cadFileIds || [])];
    const quotedCadFileIds = Array.isArray(quote.cadFileIds) ? quote.cadFileIds.map(String).sort() : [];
    if (quotedCadFileIds.length > 0 && quotedCadFileIds.join(',') !== [...cadFileIds].sort().join(',')) {
      throw new Error('The submitted CAD files do not match the quoted files.');
    }
    if (cadFileIds.length > 0) {
      const files = await prisma.cadFile.findMany({
        where: { id: { in: cadFileIds }, OR: [{ userId: orderData.userId }, { userId: null, guestId: orderData.guestCadId }] },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      if (files.length !== cadFileIds.length) throw new Error('One or more CAD files do not belong to this customer.');
      const hasUnreadyFile = files.some((file) => {
        const version = file.versions[0];
        const metadata = version?.metadata as { geometryStatus?: string; supportLevel?: string; volume?: number; surfaceArea?: number; dimensions?: unknown } | null;
        return !version
          || version.processingStatus !== 'COMPLETE'
          || metadata?.geometryStatus !== 'READY'
          || metadata.supportLevel === 'FAILED_VALIDATION'
          || !metadata.volume
          || !metadata.surfaceArea
          || !metadata.dimensions;
      });
      if (hasUnreadyFile) throw new Error('All CAD files must complete valid engineering analysis before an order can be submitted.');
      if (orderData.guestCadId) await prisma.cadFile.updateMany({ where: { id: { in: cadFileIds }, userId: null, guestId: orderData.guestCadId }, data: { userId: orderData.userId, guestId: null } });
    }
    const orderId =
      orderData.id || `CAM-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const engine = getManufacturingEngine();
    const dispatchResult = await engine.dispatchOrder({
      orderId,
      technology: orderData.technology || 'Industrial 3D Printing',
      material: orderData.material || 'PA 12 (Nylon 12)',
      quantity: orderData.quantity || 1,
      tolerance: orderData.tolerance || '±0.15 mm (ISO 2768-m)',
      surfaceFinish: orderData.surfaceFinish || 'Standard Micro Bead-Blasted',
      shippingAddress: '742 Innovation Way, Bldg 4, San Francisco, CA', // Example address
    });

    const history: Prisma.JsonArray = [
      {
        step: 'CAD Geometry Verification',
        date: 'Just now',
        done: true,
        desc: 'Automated DFM verification confirmed by CAM LABS.',
      },
      {
        step: 'CAM Toolpath & Machine Slicing',
        date: 'Pending',
        done: false,
        desc: 'Queued in calibrated partner production node.',
      },
      {
        step: 'Fabrication & Sintering / Milling',
        date: 'Pending',
        done: false,
        desc: 'Manufacturing execution.',
      },
      {
        step: 'Zeiss CMM Laser QA Inspection',
        date: 'Pending',
        done: false,
        desc: 'Tolerance verification against ISO 2768.',
      },
      {
        step: 'Express Courier Dispatch',
        date: 'Pending',
        done: false,
        desc: 'Global courier tracking.',
      },
    ];

    const newOrder = await prisma.order.create({
      data: {
        id: orderId,
        userId: orderData.userId,
        quoteId: orderData.quoteId,
        partName: orderData.partName || 'Custom_Component.step',
        technology: orderData.technology || 'Industrial 3D Printing',
        material: orderData.material || 'PA 12 (Nylon 12)',
        quantity: orderData.quantity || 1,
        date: new Date().toISOString().split('T')[0],
        estDelivery: dispatchResult.estimatedCompletion,
        status: 'In Review',
        statusBadge: 'badge-blue',
        progressStep: 1,
        manufacturingCost: quote.manufacturingCost,
        totalCost: quote.totalPrice,
        tolerance: orderData.tolerance || '±0.15 mm (ISO 2768-m)',
        provider: dispatchResult.engineName,
        providerOrderRef: dispatchResult.internalOrderRef,
        trackingNum: dispatchResult.trackingId,
        history,
        cadFiles: cadFileIds.length > 0 ? { create: cadFileIds.map((cadFileId) => { const config = orderData.cadFileConfigs?.find((candidate) => candidate.cadFileId === cadFileId); return { cadFileId, configuration: config?.configuration as Prisma.InputJsonValue | undefined, totalCost: config?.totalCost }; }) } : undefined,
      },
      include: { cadFiles: { include: { cadFile: true } } },
    });

    Logger.info(
      `[OrdersService] Created and queued internal CAM LABS order ${newOrder.id}`
    );

    return newOrder;
  }

  /**
   * Convert an existing approved quote into a production order
   */
  static async convertQuoteToOrder(quoteId: string): Promise<Order | null> {
    const prisma = getPrismaClient();
    const quote = await QuotesService.getQuoteById(quoteId);
    if (!quote) return null;

    if (!(await this.validateQuoteValidity(quoteId))) {
      throw new Error(`Quote ${quoteId} has expired or is invalid. Please request a fresh quotation.`);
    }

    const updatedQuote = await prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'Approved' },
    });

    const newOrder = await this.createOrder({
      userId: quote.userId,
      quoteId: quote.id,
      partName: quote.partName,
      technology: quote.technology,
      material: quote.material,
      quantity: quote.quantity,
      totalCost: quote.totalPrice,
      tolerance:
        quote.toleranceGrade === 'precision'
          ? '±0.025 mm (ISO 2768-f)'
          : '±0.15 mm (ISO 2768-m)',
      surfaceFinish: quote.surfaceFinish || undefined,
    });
    
    Logger.info(`[OrdersService] Converted quote ${updatedQuote.id} to order ${newOrder.id}.`);

    return newOrder;
  }

  /**
   * List all orders
   */
  static async getAllOrders(userId?: string): Promise<Order[]> {
    const prisma = getPrismaClient();
    if (userId) {
      return prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { cadFiles: { include: { cadFile: true } } },
      });
    }
    return prisma.order.findMany({ orderBy: { createdAt: 'desc' }, include: { cadFiles: { include: { cadFile: true } } } });
  }

  /**
   * Find order by ID
   */
  static async getOrderById(id: string): Promise<Order | null> {
    const prisma = getPrismaClient();
    return prisma.order.findUnique({ where: { id }, include: { cadFiles: { include: { cadFile: true } } } });
  }
}
