import { getPrismaClient } from '../config/database';
import { AppError } from '../utils/errors';
import { Logger } from '../utils/logger';

export const DELETION_REQUEST_PENDING = 'PENDING';
export const DELETION_REQUEST_APPROVED = 'APPROVED';
export const DELETION_REQUEST_REJECTED = 'REJECTED';

/**
 * QuoteDeletionService — deletion-by-approval lifecycle.
 *
 * Customers file a PENDING request (never a direct delete). An authorized
 * admin APPROVES (Quote row removed transactionally; shared CAD source files
 * are never touched) or REJECTS (Quote stays active).
 */
export class QuoteDeletionService {
  /** File a deletion request for the caller's own active Quote. */
  static async requestDeletion(params: { quoteId: string; userId: string; reason?: string }) {
    const prisma = getPrismaClient() as any;
    const quote = await prisma.quote.findUnique({
      where: { id: params.quoteId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!quote || quote.userId !== params.userId) {
      throw new AppError('Quote not found.', 404, 'QUOTE_NOT_FOUND');
    }
    if (quote.convertedOrderId || quote.status === 'Approved') {
      throw new AppError(
        'This quote has already been approved or converted into an order and can no longer be deleted. Contact support if you need changes.',
        409,
        'QUOTE_PROTECTED',
      );
    }
    const existing = await prisma.quoteDeletionRequest.findFirst({
      where: { quoteId: params.quoteId, status: DELETION_REQUEST_PENDING },
    });
    if (existing) return existing;

    try {
      return await prisma.quoteDeletionRequest.create({
        data: {
          quoteId: params.quoteId,
          requestedByUserId: params.userId,
          status: DELETION_REQUEST_PENDING,
          reason: (params.reason || '').trim().slice(0, 1000) || null,
          quoteReference: (quote.reference as string) || quote.id,
          quotePartName: quote.partName || null,
          customerName: (quote.user?.name as string) || null,
          customerEmail: (quote.user?.email as string) || null,
        },
      });
    } catch (err: any) {
      // Partial unique index race: a concurrent request won — reuse it.
      if (String(err?.code) === 'P2002') {
        const winner = await prisma.quoteDeletionRequest.findFirst({
          where: { quoteId: params.quoteId, status: DELETION_REQUEST_PENDING },
        });
        if (winner) return winner;
      }
      throw err;
    }
  }

  /** Active PENDING request for a Quote (null when none). */
  static async pendingForQuote(quoteId: string) {
    const prisma = getPrismaClient() as any;
    return prisma.quoteDeletionRequest.findFirst({
      where: { quoteId, status: DELETION_REQUEST_PENDING },
    });
  }

  /** Admin review queue (newest first), enriched for the workflow. */
  static async listRequests(filter?: { status?: string }) {
    const prisma = getPrismaClient() as any;
    const where = filter?.status ? { status: filter.status } : {};
    return prisma.quoteDeletionRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      include: {
        quote: {
          include: {
            user: { select: { id: true, name: true, email: true, company: true } },
          },
        },
      },
    });
  }

  /** Approve: mark APPROVED and remove the Quote transactionally. */
  static async approve(requestId: string, adminId: string, adminNote?: string) {
    const prisma = getPrismaClient() as any;
    const existing = await prisma.quoteDeletionRequest.findUnique({
      where: { id: requestId },
      include: { quote: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    if (!existing) throw new AppError('Deletion request not found.', 404, 'DELETION_REQUEST_NOT_FOUND');
    if (existing.status !== DELETION_REQUEST_PENDING) {
      throw new AppError(`This deletion request has already been ${existing.status.toLowerCase()}.`, 409, 'DELETION_REQUEST_RESOLVED');
    }
    if (existing.quote?.convertedOrderId) {
      throw new AppError('This quote has already been converted to an order and can no longer be deleted.', 409, 'QUOTE_CONVERTED');
    }

    return prisma.$transaction(async (tx: any) => {
      const now = new Date();
      // Resolve the request first so a concurrent conversion attempt (which
      // checks for PENDING inside its own reservation) cannot interleave.
      // Snapshots are stamped here too so the APPROVED row stays a complete
      // audit record after the Quote row is removed (FK is SET NULL).
      const reviewed = await tx.quoteDeletionRequest.update({
        where: { id: requestId, status: DELETION_REQUEST_PENDING },
        data: {
          status: DELETION_REQUEST_APPROVED,
          reviewedAt: now,
          reviewedByAdminId: adminId,
          adminNote: (adminNote || '').trim().slice(0, 1000) || null,
          quoteReference: existing.quoteReference || existing.quote?.reference || existing.quoteId,
          quotePartName: existing.quotePartName || existing.quote?.partName || null,
          customerName: existing.customerName || existing.quote?.user?.name || null,
          customerEmail: existing.customerEmail || existing.quote?.user?.email || null,
        },
      });
      // Quote removal: messages cascade; technical documents + coupon usages
      // detach (SetNull) so files and accounting survive; shared CAD source
      // files are never touched (no FK from Quote to CadFile). The reviewed
      // request row survives with quoteId nulled (SET NULL) for audit.
      await tx.quote.delete({ where: { id: existing.quoteId } });
      Logger.info(`[QuoteDeletionService] Admin ${adminId} approved deletion of quote ${existing.quoteId}.`);
      return reviewed;
    });
  }

  /** Reject: Quote stays active, request becomes REJECTED. */
  static async reject(requestId: string, adminId: string, adminNote?: string) {
    const prisma = getPrismaClient() as any;
    const existing = await prisma.quoteDeletionRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new AppError('Deletion request not found.', 404, 'DELETION_REQUEST_NOT_FOUND');
    if (existing.status !== DELETION_REQUEST_PENDING) {
      throw new AppError(`This deletion request has already been ${existing.status.toLowerCase()}.`, 409, 'DELETION_REQUEST_RESOLVED');
    }
    return prisma.quoteDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: DELETION_REQUEST_REJECTED,
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
        adminNote: (adminNote || '').trim().slice(0, 1000) || null,
      },
    });
  }
}
