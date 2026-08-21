import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrismaClient } from '../src/config/database';
import authRoutes from '../src/routes/auth.routes';
import { errorHandler } from '../src/middleware/error.middleware';
import { requireAuth } from '../src/middleware/auth.middleware';
import { requireOwnerOrRole, requireRoles } from '../src/middleware/authorization.middleware';
import { verifyPassword } from '../src/auth/password.service';

const TEST_DATABASE_NAME = 'cam_labs_phase02_test';
const databaseUrl = process.env.DATABASE_URL || '';

if (!databaseUrl.includes(`/${TEST_DATABASE_NAME}`)) {
  throw new Error(`DATABASE_URL must target the isolated ${TEST_DATABASE_NAME} database.`);
}

const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');

const cookieValue = (setCookie: string): string => setCookie.split(';', 1)[0];

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.get('/role/customer', requireAuth, requireRoles('CUSTOMER'), (_req, res) => res.sendStatus(204));
  app.get('/role/admin', requireAuth, requireRoles('ADMIN'), (_req, res) => res.sendStatus(204));
  app.get('/owner/:id', requireAuth, requireOwnerOrRole((req) => req.params.id, 'ADMIN'), (_req, res) => res.sendStatus(204));
  app.use(errorHandler);
  return app;
};

const register = async (app: express.Express, email: string, name = 'Database Engineer') =>
  request(app).post('/api/v1/auth/register').send({ name, email, password: 'ValidPass1' });

describe('PostgreSQL authentication integration', () => {
  const prisma = getPrismaClient();
  const app = createTestApp();

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('persists registration, a bcrypt password hash, and a session with an HttpOnly cookie', async () => {
    const response = await register(app, 'registered@example.com');

    expect(response.status).toBe(201);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'registered@example.com' } });
    expect(user.accountStatus).toBe('ACTIVE');
    expect(user.passwordHash).not.toBe('ValidPass1');
    expect(await verifyPassword('ValidPass1', user.passwordHash!)).toBe(true);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it('rejects duplicate registration', async () => {
    expect((await register(app, 'duplicate@example.com')).status).toBe(201);
    const duplicate = await register(app, 'duplicate@example.com');

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ACCOUNT_EXISTS');
    expect(await prisma.user.count({ where: { email: 'duplicate@example.com' } })).toBe(1);
  });

  it('logs in, resolves /auth/me, and revokes the persisted session on logout', async () => {
    await register(app, 'login@example.com');
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: 'login@example.com', password: 'ValidPass1' });
    const sessionCookie = cookieValue(login.headers['set-cookie'][0]);
    const token = decodeURIComponent(sessionCookie.split('=', 2)[1]);

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(await prisma.session.count({ where: { tokenHash: tokenHash(token) } })).toBe(1);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);
    expect(logout.headers['set-cookie'][0]).toContain('Max-Age=0');
    expect(await prisma.session.count({ where: { tokenHash: tokenHash(token) } })).toBe(0);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('rejects expired sessions and removes them from PostgreSQL', async () => {
    const registration = await register(app, 'expired@example.com');
    const token = decodeURIComponent(cookieValue(registration.headers['set-cookie'][0]).split('=', 2)[1]);
    await prisma.session.update({
      where: { tokenHash: tokenHash(token) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    expect((await request(app).get('/api/v1/auth/me').set('Cookie', `cam_labs_session=${token}`)).status).toBe(401);
    expect(await prisma.session.count({ where: { tokenHash: tokenHash(token) } })).toBe(0);
  });

  it('rejects inactive accounts during login and authenticated requests', async () => {
    const registration = await register(app, 'inactive@example.com');
    const token = decodeURIComponent(cookieValue(registration.headers['set-cookie'][0]).split('=', 2)[1]);
    await prisma.user.update({ where: { email: 'inactive@example.com' }, data: { accountStatus: 'INACTIVE' } });

    const login = await request(app).post('/api/v1/auth/login').send({ email: 'inactive@example.com', password: 'ValidPass1' });
    expect(login.status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', `cam_labs_session=${token}`)).status).toBe(401);
    expect(await prisma.session.count({ where: { tokenHash: tokenHash(token) } })).toBe(0);
  });

  it('enforces RBAC and ownership while allowing an admin elevation', async () => {
    const ownerRegistration = await register(app, 'owner@example.com');
    const ownerCookie = cookieValue(ownerRegistration.headers['set-cookie'][0]);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@example.com' } });
    const otherRegistration = await register(app, 'other@example.com');
    const otherCookie = cookieValue(otherRegistration.headers['set-cookie'][0]);

    expect((await request(app).get('/role/customer').set('Cookie', ownerCookie)).status).toBe(204);
    expect((await request(app).get('/role/admin').set('Cookie', ownerCookie)).status).toBe(403);
    expect((await request(app).get(`/owner/${owner.id}`).set('Cookie', ownerCookie)).status).toBe(204);
    expect((await request(app).get(`/owner/${owner.id}`).set('Cookie', otherCookie)).status).toBe(403);

    await prisma.user.update({ where: { email: 'other@example.com' }, data: { role: 'ADMIN' } });
    expect((await request(app).get('/role/admin').set('Cookie', otherCookie)).status).toBe(204);
    expect((await request(app).get(`/owner/${owner.id}`).set('Cookie', otherCookie)).status).toBe(204);
  });
});