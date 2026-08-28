/**
 * Manufacturing Request & Order Event Backfill
 *
 * Idempotently backfills the in-house manufacturing request and `ORDER_CREATED` /
 * `MANUFACTURER_ASSIGNED` events for orders that were created before the
 * manufacturing architecture existed (Phase 4). Orders are always routed to the
 * CAM LABS internal production cell; no external providers are used.
 *
 * Run with: npm run backfill-manufacturing
 */

import { getPrismaClient } from '../config/database';
import { Logger } from '../utils/logger';

const INTERNAL_MANUFACTURER = 'CAM LABS Internal Manufacturing Cell';

const orderStatusToRequestStatus: Record<string, string> = {
  'In Review': 'PENDING',
  'In Production': 'IN_PROGRESS',
  'Quality Inspection': 'QUALITY',
  'Delivered': 'COMPLETED',
  'Cancelled': 'CANCELLED',
};

async function main(): Promise<void> {
  const prisma = getPrismaClient();

  const cell = await prisma.manufacturer.findUnique({
    where: { companyName: INTERNAL_MANUFACTURER },
  });
  if (!cell) {
    throw new Error(`Internal manufacturing cell '${INTERNAL_MANUFACTURER}' not found. Run the database seed first.`);
  }

  const orders = await prisma.order.findMany({
    select: {
      id: true,
      technology: true,
      material: true,
      quantity: true,
      status: true,
      estDelivery: true,
    },
    where: { manufacturingRequests: { none: {} } },
  });

  let backfilled = 0;
  for (const order of orders) {
    await prisma.$transaction([
      prisma.manufacturingRequest.create({
        data: {
          orderId: order.id,
          manufacturerId: cell.id,
          technology: order.technology,
          material: order.material,
          quantity: order.quantity,
          status: orderStatusToRequestStatus[order.status] || 'PENDING',
          estimatedCompletion: order.estDelivery || undefined,
          notes: 'CAM LABS in-house production cell (backfilled)',
        },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'ORDER_CREATED',
          description: 'Order created and queued in CAM LABS internal manufacturing.',
        },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'MANUFACTURER_ASSIGNED',
          description: `Manufacturing assigned to ${INTERNAL_MANUFACTURER}.`,
          metadata: { manufacturerId: cell.id },
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { manufacturerId: cell.id },
      }),
    ]);
    backfilled += 1;
  }

  Logger.info(`Backfill complete. Orders updated: ${backfilled} (all remaining orders already had manufacturing requests).`);
}

main()
  .catch((error) => {
    Logger.error(`Backfill failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  })
  .finally(async () => {
    await getPrismaClient().$disconnect();
  });