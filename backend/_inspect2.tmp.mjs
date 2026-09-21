import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const run = async () => {
  const orders = await prisma.order.findMany({ select: { id: true, reference: true, quoteId: true, status: true, totalCost: true, partName: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
  const quotes = await prisma.quote.findMany({ select: { id: true, reference: true, convertedOrderId: true, status: true, partName: true, cadFileIds: true, createdAt: true } });

  console.log('=== ORDERS (id | reference | quoteId | status | partName | createdAt) ===');
  for (const o of orders) console.log(`${o.id} | ref=${o.reference} | quoteId=${o.quoteId} | ${o.status} | ${o.partName} | ${o.createdAt.toISOString()}`);

  console.log('\n=== QUOTES WITH convertedOrderId set ===');
  for (const q of quotes.filter(q => q.convertedOrderId)) console.log(`${q.id} | ref=${q.reference} | conv=${q.convertedOrderId} | ${q.status} | ${q.partName}`);

  console.log('\n=== Non-converted quotes whose reference matches an ORDER ===');
  const byRef = new Map(quotes.map(q => [q.reference, q]));
  for (const o of orders) {
    const q = byRef.get(o.reference);
    if (q && !q.convertedOrderId) {
      console.log(`ORDER ${o.id} (${o.status}) quoteRef ${o.reference} -> QUOTE ${q.id} (${q.status}) NOT converted`);
    }
  }

  console.log('\n=== DUPLICATES: multiple orders sharing reference ===');
  const refGroups = new Map();
  for (const o of orders) {
    const k = o.reference || o.quoteId;
    if (!refGroups.has(k)) refGroups.set(k, []);
    refGroups.get(k).push(o.id);
  }
  for (const [k, v] of refGroups) if (v.length > 1) console.log(`REF ${k}: ${v.join(', ')}`);

  console.log('\n=== ORDERS with NO quoteId ===');
  for (const o of orders.filter(o => !o.quoteId)) console.log(`${o.id} | ${o.status} | ${o.partName} | ${o.createdAt.toISOString()}`);

  await prisma.$disconnect();
};
run().catch(e => { console.error(e); process.exit(1); });
