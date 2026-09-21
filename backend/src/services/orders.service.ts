import { getManufacturingEngine } from '../providers/manufacturing';
import { Logger } from '../utils/logger';
import { QuotesService } from './quotes.service';
import { getPrismaClient } from '../config/database';
import { Order, Prisma } from '@prisma/client';
import { ManufacturingDispatchResult } from '../providers/manufacturing/IManufacturingProvider';
import { AppError } from '../utils/errors';
import { randomInt } from 'crypto';
import { TechnicalDocumentsService } from './technicalDocuments.service';
import { BusinessReferenceService } from './businessReference.service';

interface CreateOrderInternalOptions {
  /** Server-issued order id reserved atomically against the source quote. */
  reservedOrderId?: string;
  /** Unified reference already reserved on the quote (avoids extra DB round-trips). */
  reservedReference?: string;
}

/** Surcharge applied by the server when priority shipping is requested. */
export const PRIORITY_SHIPPING_FEE_EGP = 100;

const EGP_FORMAT_REGEX = /-?\d[\d,]*\.?\d*/;

/** Parses a formatted EGP string like "1,480.00 EGP" into its numeric value. */
const parseEgp = (formatted: string): number => {
  const match = String(formatted).match(EGP_FORMAT_REGEX);
  if (!match) return 0;
  const value = parseFloat(match[0].replace(/,/g, ''));
  return Number.isFinite(value) ? value : 0;
};

/** Formats a numeric EGP amount exactly like the pricing engine backend. */
const formatEgp = (amount: number): string =>
  `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;

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
   * Generate a server-side order identifier. Callers can never influence
   * the primary key — the raw, unpredictable sequence prevents crafted PK
   * collisions from interfering with order creation (hardening).
   */
  private static generateOrderId(): string {
    return `CAM-2026-${randomInt(100000, 1000000)}`;
  }

  /**
   * Create and dispatch a new manufacturing order
   */
  static async createOrder(
    orderData: Partial<Order> & { surfaceFinish?: string; cadFileIds?: string[]; cadFileConfigs?: Array<{ cadFileId: string; configuration?: Record<string, unknown>; totalCost?: string }>; guestCadId?: string; technicalNotes?: string; technicalDocumentIds?: string[]; priorityShipping?: boolean },
    internal: CreateOrderInternalOptions = {}
  ): Promise<Order> {
    const prisma = getPrismaClient();

    // NEW (Phase 04): Validate quote is not expired
    if (!orderData.quoteId) throw new AppError('A valid quote is required before an order can be submitted.', 400, 'QUOTE_REQUIRED');
    const quote = await prisma.quote.findUnique({ where: { id: orderData.quoteId }, include: { technicalDocuments: true } });
    if (!quote || quote.userId !== orderData.userId) throw new AppError('Quote is invalid or does not belong to this customer.', 403, 'QUOTE_NOT_OWNED');
    if (quote.convertedOrderId && quote.convertedOrderId !== internal.reservedOrderId) {
      throw new AppError('This quote has already been converted to an order.', 409, 'QUOTE_ALREADY_CONVERTED');
    }
    // Deletion-request vs conversion race: never create an Order from a Quote
    // with an open PENDING deletion request (applies to both the direct and
    // the canonical conversion paths).
    if (!internal.reservedOrderId) {
      let pendingDeletion: unknown = null;
      try {
        pendingDeletion = await (prisma as any).quoteDeletionRequest?.findFirst?.({
          where: { quoteId: orderData.quoteId, status: 'PENDING' },
        });
      } catch {
        pendingDeletion = null;
      }
      if (pendingDeletion) {
        throw new AppError(
          'This quote has a pending deletion request. Resolve the request before creating an order.',
          409,
          'DELETION_REQUEST_PENDING',
        );
      }
    }
    if (!(await this.validateQuoteValidity(orderData.quoteId))) {
      throw new AppError(`Quote ${orderData.quoteId} has expired or is invalid. Please request a fresh quotation.`, 400, 'QUOTE_EXPIRED');
    }
    // Only an admin-approved quote may become an order. This preserves the
    // lifecycle: submit → quote (Ready for Approval) → admin approves via
    // convertQuoteToOrder → exactly ONE order. A direct creation attempt
    // against a pending/rejected quote is refused before any write.
    if (quote.status !== 'Approved') {
      throw new AppError('This quote has not been approved yet. Please contact CAM LABS support before creating an order.', 400, 'QUOTE_NOT_APPROVED');
    }
    if (quote.technology !== (orderData.technology || '') || quote.material !== (orderData.material || '') || quote.quantity !== (orderData.quantity || 1)) {
      throw new AppError('The submitted manufacturing configuration does not match the quoted configuration.', 400, 'CONFIG_MISMATCH');
    }

    // Priority shipping is a server-side, derived surcharge. The quoted base
    // price is never mutated — the fee is added only when the customer opted
    // in, and only the server decides it (clients never supply an amount).
    const shippingFee = orderData.priorityShipping ? PRIORITY_SHIPPING_FEE_EGP : 0;
    const shippingCost = shippingFee > 0 ? formatEgp(shippingFee) : null;
    const shippingMethod = orderData.priorityShipping ? 'Priority Express Courier' : 'Express Courier';
    // When shipping is off the stored total is the quote verbatim (no drift);
    // when enabled it is base + the fixed server fee.
    const orderTotalCost = shippingFee > 0 ? formatEgp(parseEgp(quote.totalPrice) + shippingFee) : quote.totalPrice;

    const cadFileIds = [...new Set(orderData.cadFileIds || [])];
    const quotedCadFileIds = Array.isArray(quote.cadFileIds) ? quote.cadFileIds.map(String).sort() : [];
    const submittedIds = [...cadFileIds].sort();
    // Guard in BOTH directions: an order must reference exactly the same CAD
    // files that were quoted — never fewer, never more, never a different set.
    if (quotedCadFileIds.join(',') !== submittedIds.join(',')) {
      throw new AppError('The submitted CAD files do not match the quoted files.', 400, 'CAD_MISMATCH');
    }
    if (cadFileIds.length > 0) {
      const files = await prisma.cadFile.findMany({
        where: { id: { in: cadFileIds }, OR: [{ userId: orderData.userId }, { userId: null, guestId: orderData.guestCadId }] },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      if (files.length !== cadFileIds.length) throw new AppError('One or more CAD files do not belong to this customer.', 403, 'CAD_NOT_OWNED');
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
      if (hasUnreadyFile) throw new AppError('All CAD files must complete valid engineering analysis before an order can be submitted.', 400, 'CAD_NOT_READY');
      if (orderData.guestCadId) await prisma.cadFile.updateMany({ where: { id: { in: cadFileIds }, userId: null, guestId: orderData.guestCadId }, data: { userId: orderData.userId, guestId: null } });
    }

    // Technical documentation: the order must carry exactly the documents that
    // were quoted (never fewer, never more), and they must belong to the
    // customer. Guest-owned documents are claimed by the user just like CAD.
    const technicalDocumentIds = await TechnicalDocumentsService.resolveForOrder({
      userId: orderData.userId || undefined,
      guestId: orderData.guestCadId || undefined,
      quoteId: orderData.quoteId,
      quoteDocumentIds: (quote.technicalDocuments || []).map((document) => document.id),
      technicalDocumentIds: orderData.technicalDocumentIds,
    });
    const technicalNotes = (orderData.technicalNotes !== undefined && orderData.technicalNotes.trim() !== '')
      ? orderData.technicalNotes.trim()
      : (quote.technicalNotes || '').trim();

    // Shipping address resolution: prefer the submitted value, otherwise fall
    // back to the customer profile address. No hardcoded placeholder addresses.
    let profileAddress = '';
    if (orderData.userId) {
      try {
        const customerUser = await prisma.user.findUnique({ where: { id: orderData.userId } });
        profileAddress = customerUser?.address?.trim() || '';
      } catch (err: any) {
        Logger.warn(`[OrdersService] Could not load profile address: ${err.message}`);
      }
    }
    const shippingAddress = orderData.shippingAddress?.trim() || profileAddress || 'To be confirmed with customer';

    const orderId = internal.reservedOrderId || this.generateOrderId();
    // Unified reference: reuse the Quote's reference when present (new submit flow),
    // otherwise generate once here. The reservation below carries it atomically
    // so no extra DB round-trip is needed (preserves single-claim semantics).
    const unifiedFromQuote = typeof (quote as any).reference === 'string' && (quote as any).reference
      ? (quote as any).reference as string
      : null;
    const unifiedReference: string = internal.reservedReference || unifiedFromQuote || await BusinessReferenceService.generateUniqueReference();

    // Direct submissions (POST /orders) must claim the quote atomically — the
    // pre-check above is read-then-act, so two concurrent requests could
    // otherwise both pass it and create two orders from one quote.
    // convertQuoteToOrder performs its own reservation before calling in.
    let claimedHere = false;
    if (!internal.reservedOrderId) {
      // Check if the quote is already claimed (single atomic claim incl. reference).
      const claimed = await prisma.quote.updateMany({
        where: { id: orderData.quoteId, convertedOrderId: null },
        data: unifiedFromQuote ? { convertedOrderId: orderId } : { convertedOrderId: orderId, reference: unifiedReference },
      });
      if (claimed.count !== 1) {
        throw new AppError('This quote has already been converted to an order.', 409, 'QUOTE_ALREADY_CONVERTED');
      }
      claimedHere = true;
    }
    // End of claim block - no extra assignments or braces needed

    let newOrder: Order;
    let dispatchResult: ManufacturingDispatchResult;
    try {
    const engine = getManufacturingEngine();
    dispatchResult = await engine.dispatchOrder({
      orderId,
      technology: orderData.technology || 'Industrial 3D Printing',
      material: orderData.material || 'PA 12 (Nylon 12)',
      quantity: orderData.quantity || 1,
      tolerance: orderData.tolerance || '±0.15 mm (ISO 2768-m)',
      surfaceFinish: orderData.surfaceFinish || 'Standard Micro Bead-Blasted',
      shippingAddress,
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

    newOrder = await prisma.$transaction(async (tx) => {
      // Unified business reference already resolved above (no extra quote write here).
      const q: any = quote as any;
      const created = await tx.order.create({
        data: {
          id: orderId,
          reference: unifiedReference,
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
          totalCost: orderTotalCost,
          serviceFee: null, // No platform service fee is charged
          shippingAddress,
          shippingCost,
          shippingMethod,
          shippingCostAmount: (q.shippingCostAmount as number | null) ?? (shippingFee > 0 ? shippingFee : 0),
          shippingAddressSnapshot: (q.shippingAddressSnapshot as any) ?? undefined,
          billingAddressSnapshot: (q.billingAddressSnapshot as any) ?? undefined,
          contactSnapshot: (q.contactSnapshot as any) ?? undefined,
          preferredPaymentMethod: (q.preferredPaymentMethod as string | null) ?? undefined,
          couponId: (q.couponId as string | null) ?? undefined,
          couponCodeSnapshot: (q.couponCodeSnapshot as string | null) ?? undefined,
          couponDiscountTypeSnapshot: (q.couponDiscountTypeSnapshot as string | null) ?? undefined,
          couponDiscountValueSnapshot: (q.couponDiscountValueSnapshot as number | null) ?? undefined,
          couponEligibleAmountSnapshot: (q.couponEligibleAmountSnapshot as number | null) ?? undefined,
          couponDiscountAmountApplied: (q.couponDiscountAmountApplied as number | null) ?? 0,
          carrier: 'CAM LABS Express',
          tolerance: orderData.tolerance || '±0.15 mm (ISO 2768-m)',
          provider: dispatchResult.engineName,
          providerOrderRef: dispatchResult.internalOrderRef,
          trackingNum: dispatchResult.trackingId,
          technicalNotes,
          history,
          cadFiles: cadFileIds.length > 0 ? { create: cadFileIds.map((cadFileId) => { const config = orderData.cadFileConfigs?.find((candidate) => candidate.cadFileId === cadFileId); return { cadFileId, configuration: config?.configuration as Prisma.InputJsonValue | undefined }; }) } : undefined,
        },
        include: { cadFiles: { include: { cadFile: true } } },
      });
      if (technicalDocumentIds.length > 0) {
        await tx.technicalDocument.updateMany({
          where: { id: { in: technicalDocumentIds } },
          data: {
            orderId: created.id,
            quoteId: orderData.quoteId,
            ...(orderData.userId ? { userId: orderData.userId, guestId: null } : {}),
          },
        });
      }
      return created;
    });
    } catch (err) {
      if (claimedHere) {
        // Release the reservation so the quote remains redeemable.
        await prisma.quote.updateMany({ where: { id: orderData.quoteId, convertedOrderId: orderId }, data: { convertedOrderId: null } }).catch(() => undefined);
      }
      throw err;
    }

    Logger.info(
      `[OrdersService] Created and queued internal CAM LABS order ${newOrder.id}`
    );

    await this.persistManufacturingRequest(newOrder, dispatchResult).catch((error) => {
      Logger.error(`[OrdersService] Manufacturing request persistence failed for ${newOrder.id}: ${error.message}`);
    });

    return newOrder;
  }

  private static readonly INTERNAL_MANUFACTURER = 'CAM LABS Internal Manufacturing Cell';

  /**
   * Records the in-house manufacturing request (internal cell) and the
   * ORDER_CREATED / MANUFACTURER_ASSIGNED events. CAM LABS never dispatches
   * to external providers.
   */
  private static async persistManufacturingRequest(order: Order, dispatchResult: ManufacturingDispatchResult): Promise<void> {
    const prisma = getPrismaClient();
    const cell = await prisma.manufacturer.findUnique({ where: { companyName: this.INTERNAL_MANUFACTURER } });
    const manufacturerId = cell?.id ?? undefined;

    await prisma.manufacturingRequest.create({
      data: {
        orderId: order.id,
        manufacturerId,
        technology: order.technology,
        material: order.material,
        quantity: order.quantity,
        status: 'PENDING',
        estimatedCompletion: dispatchResult.estimatedCompletion,
        notes: 'CAM LABS in-house production cell',
      },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: 'ORDER_CREATED',
        description: 'Order created and queued in CAM LABS internal manufacturing.',
      },
    });

    if (manufacturerId) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'MANUFACTURER_ASSIGNED',
          description: `Manufacturing assigned to ${this.INTERNAL_MANUFACTURER}.`,
          metadata: { manufacturerId },
        },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { manufacturerId },
      });
    }
  }

  /**
   * Convert an existing approved quote into a production order.
   *
   * Conversion is guarded against double-spend: the quote is reserved
   * atomically (convertedOrderId set where it is currently null). A second
   * concurrent conversion matches zero rows and fails with 409 BEFORE any
   * order row is written, so a quote can only ever produce one order.
   */
  static async convertQuoteToOrder(quoteId: string): Promise<Order | null> {
    const prisma = getPrismaClient() as any;
    const quote = await QuotesService.getQuoteById(quoteId);
    if (!quote) throw new AppError('Quote not found.', 404, 'QUOTE_NOT_FOUND');
    if (quote.convertedOrderId) {
      throw new AppError('This quote has already been converted to an order.', 409, 'QUOTE_ALREADY_CONVERTED');
    }
    // A Quote with a PENDING deletion request must never silently convert:
    // the admin must first Reject the request (then convert) or Approve the
    // deletion (Quote removed). Checked before the atomic reservation so no
    // conversion row is written while a request is open.
    const pendingDeletion = await prisma.quoteDeletionRequest?.findFirst?.({
      where: { quoteId, status: 'PENDING' },
    });
    if (pendingDeletion) {
      throw new AppError(
        'This quote has a pending deletion request. Resolve the request (approve deletion or reject it) before converting to an order.',
        409,
        'DELETION_REQUEST_PENDING',
      );
    }
    if (!(await this.validateQuoteValidity(quoteId))) {
      throw new AppError(`Quote ${quoteId} has expired or is invalid. Please request a fresh quotation.`, 400, 'QUOTE_EXPIRED');
    }

    const orderId = this.generateOrderId();
    // Unified reference in the SAME atomic reservation (no extra DB call):
    // reuse existing quote reference when present, else reserve a fresh one.
    const existingRef = typeof (quote as any).reference === 'string' && (quote as any).reference
      ? ((quote as any).reference as string)
      : await BusinessReferenceService.generateUniqueReference();
    const reserved = await prisma.quote.updateMany({
      where: { id: quoteId, convertedOrderId: null },
      data: (quote as any).reference
        ? { status: 'Approved', convertedOrderId: orderId }
        : { status: 'Approved', convertedOrderId: orderId, reference: existingRef },
    });
    if (reserved.count !== 1) {
      throw new AppError('This quote has already been converted to an order.', 409, 'QUOTE_ALREADY_CONVERTED');
    }

    try {
      const quoteCadFileIds: string[] = Array.isArray(quote.cadFileIds) ? quote.cadFileIds.map(String) : [];
      const newOrder = await this.createOrder(
        {
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
          cadFileIds: quoteCadFileIds,
          cadFileConfigs: quoteCadFileIds.map((cadFileId) => ({ cadFileId })),
        },
        { reservedOrderId: orderId, reservedReference: existingRef }
      );

      Logger.info(`[OrdersService] Converted quote ${quote.id} to order ${newOrder.id}.`);
      return newOrder;
    } catch (err) {
      // Roll the reservation back so the quote remains redeemable if the
      // order could not be created (e.g. transient engine failure).
      await prisma.quote.update({
        where: { id: quoteId },
        data: { convertedOrderId: null, status: quote.status },
      }).catch(() => undefined);
      throw err;
    }
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
        include: { cadFiles: { include: { cadFile: true } }, technicalDocuments: true },
      });
    }
    return prisma.order.findMany({ orderBy: { createdAt: 'desc' }, include: { cadFiles: { include: { cadFile: true } }, technicalDocuments: true } });
  }

  /**
   * Find order by ID
   */
  static async getOrderById(id: string): Promise<Order | null> {
    const prisma = getPrismaClient();
    return prisma.order.findUnique({
      where: { id },
      include: {
        cadFiles: { include: { cadFile: true } },
        technicalDocuments: true,
        events: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
