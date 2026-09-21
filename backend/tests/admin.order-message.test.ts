import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../src/auth/session.service';

const state = vi.hoisted(() => {
  const adminUser = {
    id: 'admin-1',
    name: 'CAM Admin',
    email: 'admin@cam-labs.com',
    role: 'OPERATIONS_ADMIN',
    isAdmin: true,
    accountStatus: 'ACTIVE',
    company: 'CAM LABS',
    phone: null,
    avatar: null,
    tier: 'Admin',
    address: null,
    taxId: null,
    preferences: null,
    passwordHash: '',
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
    passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let currentUser: typeof customerUser = customerUser;

  const orderRecord = {
    id: 'CAM-2026-111111',
    userId: 'customer-1',
    status: 'In Review',
    user: { id: 'customer-1', name: 'Normal Customer', email: 'customer@example.com' },
  };

  const prisma = {
    session: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => ({
        id: 'session-1',
        tokenHash: where.tokenHash,
        userId: currentUser.id,
        expiresAt: new Date(Date.now() + 3600_000),
        user: currentUser,
      })),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.id === adminUser.id || where.email === adminUser.email) return adminUser;
        if (where.id === customerUser.id || where.email === customerUser.email) return customerUser;
        if (where.id === 'customer-2') return { ...customerUser, id: 'customer-2', email: 'other@example.com' };
        return null;
      }),
    },
    order: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === orderRecord.id ? orderRecord : null,
      ),
    },
    orderEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'event-1',
        createdAt: new Date('2026-09-15T12:00:00.000Z'),
        ...data,
      })),
    },
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-1' })),
    },
    cadFile: {
      // No file belongs to the signed-in owner in these tests; staff bypass
      // must still resolve the record through the owner-agnostic read path.
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === 'cad-1' && (where.userId === undefined || (where as { userId?: string }).userId === 'customer-1')) {
          return {
            id: 'cad-1',
            name: 'Bracket.STL',
            format: 'STL',
            versions: [
              {
                id: 'version-1',
                version: 1,
                format: 'STL',
                processingStatus: 'COMPLETE',
                scanStatus: 'CLEAN',
                metadata: { geometryStatus: 'READY', viewerAsset: { available: true } },
                dimensions: '10 × 10 × 10 units',
                volume: '100 cubic units',
                meshTriangles: '12',
                jobs: [],
              },
            ],
          };
        }
        return null;
      }),
    },
  };

  return { adminUser, customerUser, getCurrentUser: () => currentUser, setCurrentUser: (u: typeof customerUser) => { currentUser = u; }, prisma, orderRecord };
});

vi.mock('../src/config/database', () => ({ getPrismaClient: () => state.prisma }));

import adminRoutes from '../src/routes/admin.routes';
import cadRoutes from '../src/routes/cad.routes';
import { errorHandler } from '../src/middleware/error.middleware';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/cad-files', cadRoutes);
  app.use(errorHandler);
  return app;
};

describe('Admin order messaging (POST /admin/orders/:id/message)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('persists a customer message as an auditable order event for staff', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app)
      .post('/api/v1/admin/orders/CAM-2026-111111/message')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ message: 'Your parts ship tomorrow.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(state.prisma.orderEvent.create).toHaveBeenCalledOnce();
    const payload = state.prisma.orderEvent.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(payload.eventType).toBe('CUSTOMER_MESSAGE');
    expect(payload.orderId).toBe('CAM-2026-111111');
    expect(payload.metadata).toMatchObject({ recipientId: 'customer-1', sentBy: 'admin-1' });
    expect(state.prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('rejects empty messages with 400', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app)
      .post('/api/v1/admin/orders/CAM-2026-111111/message')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(state.prisma.orderEvent.create).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown orders', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app)
      .post('/api/v1/admin/orders/CAM-2026-000000/message')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ message: 'Hello' });

    expect(res.status).toBe(404);
    expect(state.prisma.orderEvent.create).not.toHaveBeenCalled();
  });

  it('rejects customer accounts with 403 and unauthenticated callers with 401', async () => {
    state.setCurrentUser(state.customerUser);
    const forbidden = await request(app)
      .post('/api/v1/admin/orders/CAM-2026-111111/message')
      .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`)
      .send({ message: 'Hello' });
    expect(forbidden.status).toBe(403);

    const unauthenticated = await request(app)
      .post('/api/v1/admin/orders/CAM-2026-111111/message')
      .send({ message: 'Hello' });
    expect(unauthenticated.status).toBe(401);
  });
});

describe('Admin CAD read access (order workspace thumbnails/viewer)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('lets operations staff read geometry for files owned by another user', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app)
      .get('/api/v1/cad-files/cad-1/geometry')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fileId).toBe('cad-1');
  });

  it('still scopes non-staff geometry reads to the file owner', async () => {
    state.setCurrentUser({ ...state.customerUser, id: 'customer-2', email: 'other@example.com' });
    const res = await request(app)
      .get('/api/v1/cad-files/cad-1/geometry')
      .set('Cookie', `${SESSION_COOKIE_NAME}=othertoken`);

    expect(res.status).toBe(404);
  });
});
