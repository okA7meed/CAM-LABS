import { getPrismaClient } from '../config/database';

export class AuditLogService {
  static async log(params: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: unknown;
  }) {
    const prisma = getPrismaClient() as any;
    return prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        oldValue: (params.oldValue as any) ?? undefined,
        newValue: (params.newValue as any) ?? undefined,
        metadata: (params.metadata as any) ?? undefined,
      },
    });
  }
}
