import express from 'express';
import request from 'supertest';
import http from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../src/auth/session.service';

const state = vi.hoisted(() => {
  const adminUser = {
    id: 'admin-1',
    name: 'CAM Admin',
    email: 'admin@cam-labs.com',
    role: 'ADMIN',
    isAdmin: true,
    accountStatus: 'ACTIVE',
    company: 'CAM LABS',
    phone: null,
    avatar: null,
    tier: 'Admin',
    address: null,
    taxId: null,
    preferences: null,
    passwordHash: 'hashed-admin-pass',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const customerUser = {
    id: 'customer-1',
    name: 'Normal Customer',
    email: 'customer@example.com',
    role: 'CUSTOMER',
    isAdmin: false,
    accountStatus: 'ACTIVE',
    company: 'Independent',
    phone: null,
    avatar: null,
    tier: 'Pro Engineer',
    address: null,
    taxId: null,
    preferences: null,
    passwordHash: 'hashed-customer-pass',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const registeredUser = {
    id: 'new-user-1',
    name: 'New Customer',
    email: 'new@example.com',
    role: 'CUSTOMER',
    isAdmin: false,
    accountStatus: 'ACTIVE',
    company: 'Independent',
    phone: null,
    avatar: null,
    tier: 'Pro Engineer',
    address: null,
    taxId: null,
    preferences: null,
    passwordHash: 'hashed-new-pass',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let currentUser = adminUser;
  let notifications: any[] = [];
  let unreadCount = 3;
  let runId = 0;

  const prisma = {
    session: {
      findUnique: vi.fn(async () => ({
        id: 'session-1',
        tokenHash: 'x',
        userId: currentUser.id,
        expiresAt: new Date(Date.now() + 3600_000),
        user: currentUser,
      })),
      create: vi.fn(async () => ({ id: 'session-1' })),
      delete: vi.fn(async () => undefined),
      deleteMany: vi.fn(async () => undefined),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.id === adminUser.id || where.email === adminUser.email) return adminUser;
        if (where.id === customerUser.id || where.email === customerUser.email) return customerUser;
        if (where.id === registeredUser.id || where.email === registeredUser.email) return registeredUser;
        return null;
      }),
      create: vi.fn(async () => registeredUser),
      update: vi.fn(async () => registeredUser),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adminNotification: {
      findMany: vi.fn(async () => notifications),
      count: vi.fn(async () => unreadCount),
      create: vi.fn(async (args: any) => ({ id: 'notif-created', createdAt: new Date('2026-09-06T12:00:00.000Z'), ...args?.data })),
      updateMany: vi.fn(async () => getRunContext().updateManyResult),
      findUnique: vi.fn(async () => notifications[0] ?? null),
      findFirst: vi.fn(async () => notifications[0] ?? null),
    },
    order: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    quote: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    cadFile: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    auditLog: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    payment: { findMany: vi.fn(async () => []) },
  };

  const getRunContext = () => ({ updateManyResult: { count: 1 } });

  const serviceMocks = {
    quotes: {
      calculateQuotation: vi.fn(async () => ({ totalCustomerPrice: 100 })),
      calculateMultiFileQuotation: vi.fn(async () => ({ totalCustomerPrice: 200 })),
      saveQuotation: vi.fn(async () => ({ id: 'quote-1', partName: 'Part.step' })),
      saveMultiFileQuotation: vi.fn(async () => ({ id: 'quote-2', partName: 'Parts.step' })),
      getQuoteById: vi.fn(async () => null),
    },
    orders: {
      createOrder: vi.fn(async () => ({ id: 'order-9', partName: 'Part.step' })),
      convertQuoteToOrder: vi.fn(async () => ({ id: 'order-9' })),
    },
    password: {
      hashPassword: vi.fn(async () => 'hash'),
      validatePassword: vi.fn(() => null),
      verifyPassword: vi.fn(async () => true),
    },
  };

  return {
    adminUser,
    customerUser,
    registeredUser,
    getCurrentUser: () => currentUser,
    setCurrentUser: (u: any) => { currentUser = u; },
    setNotifications: (n: any[]) => { notifications = n; },
    setUnreadCount: (n: number) => { unreadCount = n; },
    nextRunId: () => { runId += 1; return runId; },
    prisma,
    serviceMocks,
  };
});

vi.mock('../src/config/database', () => ({ getPrismaClient: () => state.prisma }));

vi.mock('../src/services/quotes.service', () => ({ QuotesService: state.serviceMocks.quotes }));
vi.mock('../src/services/orders.service', () => ({ OrdersService: state.serviceMocks.orders }));
vi.mock('../src/auth/password.service', () => ({
  hashPassword: state.serviceMocks.password.hashPassword,
  validatePassword: state.serviceMocks.password.validatePassword,
  verifyPassword: state.serviceMocks.password.verifyPassword,
}));

import authRoutes from '../src/routes/auth.routes';
import adminRoutes from '../src/routes/admin.routes';
import quotesRoutes from '../src/routes/quotes.routes';
import ordersRoutes from '../src/routes/orders.routes';
import { AdminService } from '../src/services/admin.service';
import { NotificationEvents } from '../src/services/notification-events.service';
import { errorHandler } from '../src/middleware/error.middleware';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/quotes', quotesRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use(errorHandler);
  return app;
};

describe('Admin notifications — events, real-time stream & access control', () => {
  let app: express.Express;
  let notifySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    app = createTestApp();
    notifySpy = vi.spyOn(AdminService, 'notifySafely').mockImplementation(async () => undefined);
    state.setCurrentUser(state.customerUser);
    state.setNotifications([]);
    state.setUnreadCount(0);
    state.serviceMocks.quotes.getQuoteById.mockResolvedValue(null);
  });

  afterEach(() => {
    notifySpy.mockRestore();
    NotificationEvents.clearClients();
  });

  const notifyCalls = () => notifySpy.mock.calls.map((call) => call[0]);

  describe('Business events create notifications — and only on real success', () => {
    it('creates USER_REGISTERED when a new customer account is created', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'New Customer',
        email: 'freshbrand@example.com',
        password: 'Str0ngPass!',
      });
      expect(res.status).toBe(201);
      const calls = notifyCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        type: 'USER_REGISTERED',
        entityType: 'USER',
        entityId: state.registeredUser.id,
        priority: 'SUCCESS',
      });
      expect(calls[0].message).toContain(state.registeredUser.name);
      expect(calls[0].metadata.customerId).toBe(state.registeredUser.id);
    });

    it('does NOT create a notification when registration fails (duplicate account)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Admin Copy',
        email: 'admin@cam-labs.com',
        password: 'Str0ngPass!',
      });
      expect(res.status).toBe(409);
      expect(notifyCalls()).toHaveLength(0);
    });

    it('does NOT create a notification when the password is weak', async () => {
      state.serviceMocks.password.validatePassword.mockReturnValueOnce('Password must be at least 8 characters.');
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'New Customer',
        email: 'fresh@example.com',
        password: '123',
      });
      expect(res.status).toBe(400);
      expect(notifyCalls()).toHaveLength(0);
    });

    it('creates USER_LOGIN after a successful customer login', async () => {
      state.setCurrentUser(state.customerUser);
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'customer@example.com',
        password: 'RightPass!',
      });
      expect(res.status).toBe(200);
      const calls = notifyCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        type: 'USER_LOGIN',
        entityType: 'USER',
        entityId: state.customerUser.id,
        priority: 'INFO',
      });
    });

    it('does NOT create a notification for a failed login', async () => {
      state.serviceMocks.password.verifyPassword.mockResolvedValueOnce(false);
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'customer@example.com',
        password: 'WrongPass!',
      });
      expect(res.status).toBe(401);
      expect(notifyCalls()).toHaveLength(0);
    });

    it('does NOT create a notification for admin sign-in (bell tracks customer activity only)', async () => {
      state.setCurrentUser(state.adminUser);
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@cam-labs.com',
        password: 'AdminPass!',
      });
      expect(res.status).toBe(200);
      expect(notifyCalls()).toHaveLength(0);
    });

    it('creates a QUOTE notification after a single-file quote is saved', async () => {
      state.serviceMocks.quotes.saveQuotation.mockResolvedValueOnce({ id: 'quote-1', partName: 'Bracket.step' });
      const res = await request(app)
        .post('/api/v1/quotes')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`)
        .send({
          partName: 'Bracket.step',
          technology: 'SLS',
          material: 'PA 12',
          quantity: 3,
        });
      expect(res.status).toBe(201);
      const calls = notifyCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        type: 'QUOTE',
        entityType: 'QUOTE',
        entityId: 'quote-1',
        priority: 'INFO',
      });
      expect(calls[0].metadata.quoteId).toBe('quote-1');
      expect(calls[0].metadata.customerId).toBe(state.customerUser.id);
    });

    it('creates a QUOTE notification after a multi-file quote is saved', async () => {
      state.serviceMocks.quotes.saveMultiFileQuotation.mockResolvedValueOnce({ id: 'quote-2', partName: 'Parts.step' });
      const res = await request(app)
        .post('/api/v1/quotes')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`)
        .send({
          partName: 'Parts.step',
          technology: 'SLS',
          material: 'PA 12',
          quantity: 2,
          files: [{ fileId: 'file-a' }, { fileId: 'file-b' }],
        });
      expect(res.status).toBe(201);
      const calls = notifyCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ type: 'QUOTE', entityType: 'QUOTE', entityId: 'quote-2' });
    });

    it('does NOT create a notification when the quote payload is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/quotes')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`)
        .send({
          partName: '',
          technology: '',
          material: '',
          quantity: 0,
        });
      expect(res.status).toBe(400);
      expect(notifyCalls()).toHaveLength(0);
    });

    it('does NOT create a notification when quote saving fails', async () => {
      state.serviceMocks.quotes.saveQuotation.mockRejectedValueOnce(new Error('boom'));
      const res = await request(app)
        .post('/api/v1/quotes')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`)
        .send({
          partName: 'Bracket.step',
          technology: 'SLS',
          material: 'PA 12',
          quantity: 3,
        });
      expect(res.status).not.toBe(201);
      expect(notifyCalls()).toHaveLength(0);
    });

    it('creates an ORDER notification after an order is created', async () => {
      state.serviceMocks.orders.createOrder.mockResolvedValueOnce({ id: 'order-9', partName: 'Bracket.step' });
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`)
        .send({
          quoteId: 'quote-1',
          partName: 'Bracket.step',
          technology: 'SLS',
          material: 'PA 12',
          quantity: 3,
        });
      expect(res.status).toBe(201);
      const calls = notifyCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        type: 'ORDER',
        entityType: 'ORDER',
        entityId: 'order-9',
        priority: 'SUCCESS',
      });
      expect(calls[0].metadata.orderId).toBe('order-9');
    });

    it('does NOT create a notification when order creation fails', async () => {
      state.serviceMocks.orders.createOrder.mockRejectedValueOnce(new Error('boom'));
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`)
        .send({ quoteId: 'quote-1', partName: 'X', technology: 'SLS', material: 'PA 12', quantity: 1 });
      expect(res.status).not.toBe(201);
      expect(notifyCalls()).toHaveLength(0);
    });

    it('creates an ORDER notification after a quote is converted to an order', async () => {
      state.serviceMocks.quotes.getQuoteById.mockResolvedValue({ id: 'quote-1', userId: state.customerUser.id, partName: 'Bracket.step' });
      state.serviceMocks.orders.convertQuoteToOrder.mockResolvedValueOnce({ id: 'order-9' });
      const res = await request(app)
        .post('/api/v1/orders/convert-quote/quote-1')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`);
      expect(res.status).toBe(201);
      const calls = notifyCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ type: 'ORDER', entityType: 'ORDER', entityId: 'order-9' });
      expect(calls[0].metadata.quoteId).toBe('quote-1');
    });

    it('does NOT create a notification when converting an unknown quote', async () => {
      const res = await request(app)
        .post('/api/v1/orders/convert-quote/unknown')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`);
      expect(res.status).toBe(404);
      expect(notifyCalls()).toHaveLength(0);
    });
  });

  describe('Admin notification endpoints — list, unread, read, read-all', () => {
    const cannedNotification = () => ({
      id: 'n-1',
      userId: null,
      type: 'QUOTE',
      title: 'New Quote Received',
      message: 'A new quote has been submitted.',
      entityType: 'QUOTE',
      entityId: 'quote-1',
      isRead: false,
      priority: 'INFO',
      createdAt: new Date('2026-09-06T10:00:00.000Z').toISOString(),
      readAt: null,
    });

    const asAdmin = () => state.setCurrentUser(state.adminUser);

    it('lists notifications visible to an admin (global + own), newest first', async () => {
      asAdmin();
      state.setNotifications([cannedNotification()]);
      state.setUnreadCount(1);
      const res = await request(app)
        .get('/api/v1/admin/notifications?limit=7')
        .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.notifications[0].id).toBe('n-1');

      const findManyMock = state.prisma.adminNotification.findMany;
      const where = findManyMock.mock.calls.at(-1)?.[0]?.where;
      expect(where.OR).toEqual(expect.arrayContaining([{ userId: null }, { userId: state.adminUser.id }]));
      expect(findManyMock.mock.calls.at(-1)?.[0]?.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('rejects a customer from listing notifications with 403', async () => {
      state.setCurrentUser(state.customerUser);
      const res = await request(app)
        .get('/api/v1/admin/notifications')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`);
      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated access to the notification list with 401', async () => {
      const res = await request(app).get('/api/v1/admin/notifications');
      expect(res.status).toBe(401);
    });

    it('reports only the number of unread notifications in the badge endpoint', async () => {
      asAdmin();
      state.setUnreadCount(3);
      const res = await request(app)
        .get('/api/v1/admin/notifications/unread-count')
        .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(3);
      const where = state.prisma.adminNotification.count.mock.calls.at(-1)?.[0]?.where;
      expect(where.isRead).toBe(false);
      expect(where.OR).toEqual(expect.arrayContaining([{ userId: null }, { userId: state.adminUser.id }]));
    });

    it('rejects a customer from the unread-count endpoint with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/notifications/unread-count')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`);
      expect(res.status).toBe(403);
    });

    it('marks a single notification as read (global or own)', async () => {
      asAdmin();
      state.setNotifications([cannedNotification()]);
      const res = await request(app)
        .put('/api/v1/admin/notifications/n-1/read')
        .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);
      expect(res.status).toBe(200);
      const where = state.prisma.adminNotification.updateMany.mock.calls.at(-1)?.[0]?.where;
      expect(where.id).toBe('n-1');
      expect(where.OR).toEqual(expect.arrayContaining([{ userId: null }, { userId: state.adminUser.id }]));
    });

    it('returns 404 when marking a notification the admin cannot see', async () => {
      asAdmin();
      state.prisma.adminNotification.updateMany.mockResolvedValueOnce({ count: 0 });
      const res = await request(app)
        .put('/api/v1/admin/notifications/n-ghost/read')
        .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);
      expect(res.status).toBe(404);
    });

    it('marks every visible notification as read', async () => {
      asAdmin();
      const res = await request(app)
        .put('/api/v1/admin/notifications/read-all')
        .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);
      expect(res.status).toBe(200);
      expect(res.body.data.markedRead).toBe(1);
      const where = state.prisma.adminNotification.updateMany.mock.calls.at(-1)?.[0]?.where;
      expect(where.isRead).toBe(false);
      expect(where.OR).toEqual(expect.arrayContaining([{ userId: null }, { userId: state.adminUser.id }]));
    });

    it('rejects a customer from read-all with 403', async () => {
      const res = await request(app)
        .put('/api/v1/admin/notifications/read-all')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`);
      expect(res.status).toBe(403);
    });

    it('serves the SSE stream with text/event-stream and pushes new notifications', async () => {
      asAdmin();
      const server = app.listen(0);
      await new Promise<void>((resolve) => server.on('listening', () => resolve()));
      const port = (server.address() as import('node:net').AddressInfo).port;

      const frames: string[] = [];
      const stream: http.IncomingMessage = await new Promise((resolve) => {
        http
          .get({
            host: '127.0.0.1',
            port,
            path: '/api/v1/admin/notifications/stream',
            headers: { Cookie: `${SESSION_COOKIE_NAME}=admintoken` },
          })
          .on('response', (response) => {
            expect(response.headers['content-type']).toContain('text/event-stream');
            expect(response.headers['cache-control']).toContain('no-cache');
            response.on('data', (chunk: Buffer) => frames.push(chunk.toString()));
            resolve(response);
          });
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 150));
      expect(frames.join('')).toContain('event: connected');

      NotificationEvents.publish({
        id: 'n-live',
        type: 'ORDER',
        title: 'New Order Received',
        message: 'A new order arrived.',
        entityType: 'ORDER',
        entityId: 'order-9',
        isRead: false,
        priority: 'SUCCESS',
        createdAt: new Date().toISOString(),
        metadata: { type: 'ORDER' },
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 150));

      const joined = frames.join('');
      expect(joined).toContain('event: notification');
      expect(joined).toContain('"entityType":"ORDER"');
      expect(joined).toContain('n-live');

      stream.destroy();
      server.close();
      NotificationEvents.clearClients();
    });
  });

  describe('NotificationEvents bus — real-time fan-out', () => {
    it('delivers a published notification to a subscribed client', async () => {
      NotificationEvents.clearClients();
      const frames: string[] = [];
      const fakeRes = {
        write: (chunk: string) => { frames.push(chunk); return true; },
        on: () => fakeRes,
        end: () => undefined,
      } as unknown as import('node:http').ServerResponse;
      const unsubscribe = NotificationEvents.subscribe(fakeRes);
      expect(NotificationEvents.clientCount()).toBe(1);
      NotificationEvents.publish({
        id: 'n-1',
        type: 'ORDER',
        title: 'New Order Received',
        message: 'An order was created.',
        entityType: 'ORDER',
        entityId: 'order-9',
        isRead: false,
        priority: 'SUCCESS',
      });
      const joined = frames.join('');
      expect(joined).toContain('event: notification');
      expect(joined).toContain('"entityType":"ORDER"');
      unsubscribe();
      expect(NotificationEvents.clientCount()).toBe(0);
    });

    it('unsubscribes clients so the bus never leaks connections', async () => {
      NotificationEvents.clearClients();
      const fakeRes = {
        write: () => true,
        on: () => fakeRes,
        end: () => undefined,
      } as unknown as import('node:http').ServerResponse;
      const unsubscribe = NotificationEvents.subscribe(fakeRes);
      expect(NotificationEvents.clientCount()).toBe(1);
      unsubscribe();
      expect(NotificationEvents.clientCount()).toBe(0);
    });
  });

  describe('AdminService — createNotification & notifySafely', () => {
    it('persists a notification with entity references and publishes it', async () => {
      NotificationEvents.clearClients();
      const publishSpy = vi.spyOn(NotificationEvents, 'publish').mockImplementation(() => undefined);
      const created = await AdminService.createNotification({
        type: 'QUOTE',
        entityType: 'QUOTE',
        entityId: 'quote-1',
        title: 'New Quote Received',
        message: 'A new quote.',
        priority: 'INFO',
        metadata: { quoteId: 'quote-1' },
      });
      expect(publishSpy).toHaveBeenCalledTimes(1);
      expect(publishSpy.mock.calls[0][0]).toMatchObject({ entityType: 'QUOTE', entityId: 'quote-1' });
      const createArgs = state.prisma.adminNotification.create.mock.calls.at(-1)?.[0];
      expect(createArgs.data.entityType).toBe('QUOTE');
      expect(createArgs.data.entityId).toBe('quote-1');
      expect(created).toBeTruthy();
      publishSpy.mockRestore();
    });

    it('notifySafely swallows persistence errors so the customer flow is never broken', async () => {
      state.prisma.adminNotification.create.mockRejectedValueOnce(new Error('db down'));
      await expect(
        AdminService.notifySafely({ type: 'ORDER', title: 't', message: 'm', entityType: 'ORDER', entityId: 'o' })
      ).resolves.toBeUndefined();
      state.prisma.adminNotification.create.mockClear();
    });

    it('getNotifications clamps the page size to 500', async () => {
      state.setNotifications([]);
      await AdminService.getNotifications(state.adminUser.id, { limit: 5000 });
      const take = state.prisma.adminNotification.findMany.mock.calls.at(-1)?.[0]?.take;
      expect(take).toBe(500);
    });
  });
});