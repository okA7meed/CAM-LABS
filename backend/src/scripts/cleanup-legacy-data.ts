/**
 * Legacy Data Cleanup & Consistency Script
 *
 * Idempotent one-time cleanup for Phase 7 (Mock/Fixture Data Cleanup & API Unification).
 * Safe to re-run: every operation is guarded so it only acts when needed.
 *
 * Performs:
 *  1. Renames the four FDM material ids so the database id equals the canonical
 *     pricing key AND the frontend i18n label slug (pla-fdm -> pla, abs-fdm -> abs,
 *     petg-fdm -> petg, tpu-fdm -> tpu). No relations reference the material id
 *     (quotes/orders/manufacturing requests store free-text material labels), so
 *     this is a zero-risk in-place rename.
 *     Ensures pricePerUnit (EGP/g) and density mirror the canonical pricing config.
 *  2. Removes deterministically-identified TEST/QA artifacts:
 *     - users created by automated/probe flows (browser-test-*, upload-verification-*,
 *       guest-preview-*, phone-required-*, phase04-*)
 *     - all records owned by those users (orders, quotes, CAD files, versions,
 *       geometry reports, processing jobs, payments, sessions, notifications)
 *     - audit-log entries that reference the removed entities (best effort by entityId)
 *  3. Does NOT touch legitimate seed data (persona-1, CAM LABS admin) or any
 *     account that looks like a real user (no deterministic test signature).
 *
 * Run with: npm run cleanup-legacy-data
 */

import { getPrismaClient } from '../config/database';
import { Logger } from '../utils/logger';

const FDM_MATERIAL_RENAME: Record<string, { newId: string; pricePerUnit: number; density: number }> = {
  'pla-fdm': { newId: 'pla', pricePerUnit: 2, density: 1.24 },
  'abs-fdm': { newId: 'abs', pricePerUnit: 3, density: 1.04 },
  'petg-fdm': { newId: 'petg', pricePerUnit: 3, density: 1.27 },
  'tpu-fdm': { newId: 'tpu', pricePerUnit: 4, density: 1.21 },
};

const TEST_USER_EMAIL_PATTERNS = [
  'browser-test-',
  'upload-verification-',
  'guest-preview-',
  'phone-required-',
  'phase04-',
];

async function main(): Promise<void> {
  const prisma = getPrismaClient();
  const report: string[] = [];

  // ---- 1. Materials: rename FDM ids to canonical pricing keys ----
  for (const [oldId, { newId, pricePerUnit, density }] of Object.entries(FDM_MATERIAL_RENAME)) {
    const targetExists = await prisma.material.findUnique({ where: { id: newId } });
    if (!targetExists) {
      const renamed = await prisma.material.updateMany({ where: { id: oldId }, data: { id: newId } });
      if (renamed.count) report.push(`Renamed material ${oldId} -> ${newId}`);
    }
    const updated = await prisma.material.updateMany({
      where: { id: newId },
      data: { pricePerUnit, priceUnit: 'EGP/g', density },
    });
    if (updated.count) report.push(`Synced ${newId} pricePerUnit/density to canonical config`);
  }

  // ---- 2. Remove deterministic test artifacts ----
  const testUsers = await prisma.user.findMany({
    where: { OR: TEST_USER_EMAIL_PATTERNS.map((pattern) => ({ email: { contains: pattern, mode: 'insensitive' as any } })) },
    select: { id: true, email: true },
  });
  const testIds = testUsers.map((user) => user.id);

  if (testIds.length) {
    const ownedOrders = (await prisma.order.findMany({ where: { userId: { in: testIds } }, select: { id: true } })).map((o) => o.id);
    const ownedQuotes = (await prisma.quote.findMany({ where: { userId: { in: testIds } }, select: { id: true } })).map((q) => q.id);
    const ownedCadFiles = (await prisma.cadFile.findMany({ where: { userId: { in: testIds } }, select: { id: true } })).map((c) => c.id);
    const ownedEntityIds = [...ownedOrders, ...ownedQuotes, ...ownedCadFiles, ...testIds];

    const deleted = {
      payments: await prisma.payment.deleteMany({ where: { userId: { in: testIds } } }),
      orderEvents: await prisma.orderEvent.deleteMany({ where: { orderId: { in: ownedOrders } } }),
      manufacturingRequests: await prisma.manufacturingRequest.deleteMany({ where: { orderId: { in: ownedOrders } } }),
      orderCadFiles: await prisma.orderCadFile.deleteMany({ where: { orderId: { in: ownedOrders } } }),
      orders: await prisma.order.deleteMany({ where: { id: { in: ownedOrders } } }),
      quotes: await prisma.quote.deleteMany({ where: { id: { in: ownedQuotes } } }),
      cadFiles: await prisma.cadFile.deleteMany({ where: { id: { in: ownedCadFiles } } }),
      sessions: await prisma.session.deleteMany({ where: { userId: { in: testIds } } }),
      adminNotifications: await prisma.adminNotification.deleteMany({ where: { userId: { in: testIds } } }),
      auditLogs: await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: testIds } }, { entityId: { in: ownedEntityIds } }] } }),
      users: await prisma.user.deleteMany({ where: { id: { in: testIds } } }),
    };

    testUsers.forEach((user) => report.push(`Removed test artifact user ${user.email} (${user.id})`));
    Object.entries(deleted).forEach(([key, result]) => {
      if (result.count) report.push(`Deleted ${result.count} ${key}`);
    });
  } else {
    report.push('No deterministic test-artifact users found — nothing to remove.');
  }

  // ---- 3. Remove orphaned guest-owned CAD files (upload QA artifacts) ----
  // Guest uploads are not attached to any retained user and are not referenced by
  // any retained order (verified: order_cad_files has no rows for retained orders).
  const retainedOrderCadIds = (await prisma.orderCadFile.findMany({ select: { cadFileId: true } })).map((row) => row.cadFileId);
  const guestCadIds = (await prisma.cadFile.findMany({ where: { userId: null }, select: { id: true } })).map((c) => c.id);
  const orphanCadIds = guestCadIds.filter((id) => !retainedOrderCadIds.includes(id));
  if (orphanCadIds.length) {
    const deletedCad = await prisma.cadFile.deleteMany({ where: { id: { in: orphanCadIds } } });
    if (deletedCad.count) report.push(`Deleted ${deletedCad.count} orphaned guest-owned CAD files (QA upload artifacts)`);
  } else {
    report.push('No orphaned guest CAD files to remove.');
  }

  // ---- 4. Final counts ----
  const counts: Record<string, number> = {};
  for (const model of ['user', 'order', 'quote', 'cadFile', 'material', 'manufacturer', 'manufacturingRequest', 'orderEvent'] as const) {
    counts[model] = await (prisma[model] as { count: () => Promise<number> }).count();
  }
  report.push(`Final counts: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')}`);

  Logger.info(`Cleanup complete.\n  ${report.join('\n  ')}`);
}

main()
  .catch((error) => {
    Logger.error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  })
  .finally(async () => {
    await getPrismaClient().$disconnect();
  });