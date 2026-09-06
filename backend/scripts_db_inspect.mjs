import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const run = async () => {
  const orders = await prisma.order.findMany({ select: { id: true, status: true, totalCost: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
  console.log('ORDERS', orders.length);
  for (const o of orders) console.log(' ', o.id, o.status, o.totalCost, o.createdAt.toISOString());

  const orderStatusCounts = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
  console.log('ORDER_STATUS', orderStatusCounts);

  const payments = await prisma.payment.findMany();
  console.log('PAYMENTS', payments.length);
  for (const p of payments) console.log(' ', p.id?.slice(0, 8), p.paymentStatus, p.amount, p.currency, p.refundedAmount, p.createdAt?.toISOString());

  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true, accountStatus: true, isAdmin: true, createdAt: true } });
  console.log('USERS', users.length);
  for (const u of users) console.log(' ', u.role, u.accountStatus, 'isAdmin=' + u.isAdmin, u.name, u.createdAt.toISOString());

  const quotes = await prisma.quote.findMany({ select: { id: true, status: true, createdAt: true } });
  console.log('QUOTES', quotes.length);
  for (const q of quotes) console.log(' ', q.id, q.status, q.createdAt.toISOString());

  const cads = await prisma.cadFile.findMany({ select: { id: true, status: true, createdAt: true } });
  console.log('CADFILES', cads.length);
  for (const c of cads) console.log(' ', c.id.slice(0, 8), c.status, c.createdAt.toISOString());

  const mfgs = await prisma.manufacturer.findMany({ select: { id: true, companyName: true, status: true, availability: true, createdAt: true } });
  console.log('MANUFACTURERS', mfgs.length);
  for (const m of mfgs) console.log(' ', m.companyName, m.status, m.availability, m.createdAt.toISOString());

  const mfgReq = await prisma.manufacturingRequest.groupBy({ by: ['status'], _count: { _all: true } });
  console.log('MFG_REQ_STATUS', mfgReq);

  const audits = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 12, include: { user: { select: { name: true, role: true } } } });
  console.log('AUDIT_LOGS', audits.length, '(' + (await prisma.auditLog.count()) + ' total)');
  for (const a of audits) console.log(' ', a.id.slice(0, 8), a.action, a.entityType, a.entityId?.slice(0, 14), JSON.stringify(a.metadata || null), a.user?.name || 'nouser', a.createdAt.toISOString());

  const notifs = await prisma.adminNotification.findMany({ orderBy: { createdAt: 'desc' }, take: 15 });
  console.log('NOTIFICATIONS', notifs.length, 'unread=' + notifs.filter((n) => !n.isRead).length);
  for (const n of notifs) console.log(' ', n.id.slice(0, 8), n.type, 'read=' + n.isRead, n.title, n.createdAt.toISOString());

  const health = await prisma.$queryRawUnsafe('SELECT 1 AS ok');
  console.log('DB_PING', health);

  await prisma.$disconnect();
};

run().catch((e) => { console.error(e); process.exit(1); });