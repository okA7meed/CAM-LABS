import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* In-memory Prisma stand-in. Conditional updateMany writes return affected
   row counts, which is exactly the mechanism the service relies on for
   single-use semantics — so the mock faithfully exercises the race guards. */
const state = vi.hoisted(() => {
  const users = new Map<string, any>();
  const challenges = new Map<string, any>();
  const sessions = new Map<string, any>();
  const sent: Array<{ to: string; code: string }> = [];
  let emailMode: 'ok' | 'fail' | 'leak' = 'ok';
  let seq = 0;
  // UUID-shaped (hex + dashes) so the reset-token parser accepts them,
  // exactly as real Prisma uuid() ids behave in production.
  const uid = () =>
    `${(++seq).toString(16).padStart(8, '0')}-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;

  const matches = (ch: any, cond: any): boolean => {
    if (!cond) return true;
    for (const [key, rule] of Object.entries(cond)) {
      if (key === 'OR') {
        if (!(rule as any[]).some((c) => matches(ch, c))) return false;
        continue;
      }
      const value = ch[key];
      if (rule === null) {
        if (value !== null && value !== undefined) return false;
        continue;
      }
      if (typeof rule === 'object' && rule !== null && !(rule instanceof Date)) {
        for (const [op, operand] of Object.entries(rule as any)) {
          if (op === 'lt' && !(value < (operand as Date))) return false;
          if (op === 'gt' && !(value > (operand as Date))) return false;
          if (op === 'not' && (operand === null ? value == null : value === operand)) return false;
        }
        continue;
      }
      if (value !== rule) return false;
    }
    return true;
  };

  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.email) {
          for (const u of users.values()) if (u.email === where.email) return u;
          return null;
        }
        return users.get(where.id) ?? null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const user = { id: uid(), ...data };
        users.set(user.id, user);
        return user;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const user = users.get(where.id);
        Object.assign(user, data);
        return user;
      }),
    },
    passwordResetChallenge: {
      create: vi.fn(async ({ data }: any) => {
        const ch = { id: uid(), attempts: 0, verifiedAt: null, resetTokenDigest: null, resetTokenExpiresAt: null, usedAt: null, createdAt: new Date(), ...data };
        challenges.set(ch.id, ch);
        return ch;
      }),
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        const list = [...challenges.values()].filter((c) => matches(c, where));
        if (orderBy?.createdAt === 'desc') list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return list[0] ?? null;
      }),
      findUnique: vi.fn(async ({ where }: any) => challenges.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const ch = challenges.get(where.id);
        if (data.attempts?.increment) ch.attempts += data.attempts.increment;
        else Object.assign(ch, data);
        return ch;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const ch of challenges.values()) {
          if (matches(ch, where)) {
            Object.assign(ch, data);
            count++;
          }
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (const [id, ch] of challenges) {
          if (matches(ch, where)) {
            challenges.delete(id);
            count++;
          }
        }
        return { count };
      }),
    },
    session: {
      create: vi.fn(async ({ data }: any) => {
        const s = { id: uid(), ...data };
        sessions.set(s.id, s);
        return s;
      }),
      findUnique: vi.fn(async () => null),
      deleteMany: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (const [id, s] of sessions) {
          if (where.userId && s.userId !== where.userId) continue;
          if (where.tokenHash && s.tokenHash !== where.tokenHash) continue;
          sessions.delete(id);
          count++;
        }
        return { count };
      }),
    },
    adminNotification: { create: vi.fn(async () => ({ id: 'n-1' })) },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };
  return { users, challenges, sessions, sent, prisma, uid, get emailMode() { return emailMode; }, setEmailMode(m: typeof emailMode) { emailMode = m; } };
});

vi.mock('../src/config/database', () => ({ getPrismaClient: () => state.prisma }));
vi.mock('../src/services/email.service', () => ({
  EmailService: {
    sendPasswordResetCode: vi.fn(async (to: string, code: string) => {
      if (state.emailMode === 'fail') throw Object.assign(new Error('unavailable'), { code: 'EMAIL_NOT_CONFIGURED', statusCode: 503 });
      if (state.emailMode === 'leak') throw new Error('Resend boom key=SECRET_SIM_CODE=123456');
      state.sent.push({ to, code });
      return { id: 're_test' };
    }),
  },
}));

import authRoutes from '../src/routes/auth.routes';
import { errorHandler } from '../src/middleware/error.middleware';
import { hashPassword } from '../src/auth/password.service';
import { generateOtpCode } from '../src/services/password-reset.service';
import { ENV } from '../src/config/env';

const GENERIC = 'If an account exists for this email, a verification code has been sent.';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use(errorHandler);
  return app;
};

const seedUser = async (email: string, passwordHash: string | null) => {
  const user = {
    id: state.uid(), name: 'Reset Tester', email, role: 'CUSTOMER', isAdmin: false,
    accountStatus: 'ACTIVE', company: 'Test Co', phone: null, avatar: null, tier: 'Pro Engineer',
    address: null, taxId: null, preferences: null, passwordHash, failedLoginAttempts: 0,
    lockedUntil: null, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
  };
  state.users.set(user.id, user);
  return user;
};

const lastCodeFor = (to: string) => state.sent.filter((s) => s.to === to).at(-1)!.code;

beforeEach(() => {
  state.users.clear();
  state.challenges.clear();
  state.sessions.clear();
  state.sent.length = 0;
  state.setEmailMode('ok');
  vi.unstubAllGlobals();
});

describe('password reset via 6-digit OTP', () => {
  it('1. existing email gets a generic response, a hashed challenge, and an email', async () => {
    await seedUser('exists@example.com', await hashPassword('OldPass1'));
    const res = await request(createTestApp()).post('/api/v1/auth/forgot-password').send({ email: 'exists@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe(GENERIC);
    expect(state.sent).toHaveLength(1);
    const ch = [...state.challenges.values()][0];
    expect(ch.attempts).toBe(0);
    expect(ch.codeDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(ch.codeDigest).not.toContain(lastCodeFor('exists@example.com'));
  });

  it('2. non-existing email receives the identical public response with no side effects', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' });
    const other = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'someone-else@example.com' });
    expect(res.status).toBe(200);
    expect(other.status).toBe(200);
    // Identical shape: same keys, same generic message — no oracle.
    expect(Object.keys(res.body).sort()).toEqual(Object.keys(other.body).sort());
    expect(res.body.data.message).toBe(GENERIC);
    expect(other.body.data.message).toBe(GENERIC);
    expect(state.challenges.size).toBe(0);
    expect(state.sent).toHaveLength(0);
  });

  it('3. OTPs are 6 digits, support leading zeros, and vary', () => {
    const samples = Array.from({ length: 200 }, () => generateOtpCode());
    expect(samples.every((s) => /^[0-9]{6}$/.test(s))).toBe(true);
    expect(samples.some((s) => s.startsWith('0'))).toBe(true);
    expect(new Set(samples).size).toBeGreaterThan(150);
  });

  it('4. expired OTP is rejected', async () => {
    await seedUser('exp@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'exp@example.com' });
    const code = lastCodeFor('exp@example.com');
    [...state.challenges.values()][0].expiresAt = new Date(Date.now() - 1000);
    const res = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'exp@example.com', code });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('RESET_CODE_EXPIRED');
  });

  it('5/6. wrong OTP is rejected and the attempt count increases', async () => {
    await seedUser('wrong@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'wrong@example.com' });
    const r1 = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'wrong@example.com', code: '000000' });
    expect(r1.status).toBe(401);
    expect(r1.body.error.code).toBe('INVALID_RESET_CODE');
    expect([...state.challenges.values()][0].attempts).toBe(1);
    await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'wrong@example.com', code: '000001' });
    expect([...state.challenges.values()][0].attempts).toBe(2);
  });

  it('7. exceeding 5 attempts locks the challenge', async () => {
    await seedUser('lock@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'lock@example.com' });
    const code = lastCodeFor('lock@example.com');
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'lock@example.com', code: '999999' });
    }
    // Even the correct code is now refused.
    const res = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'lock@example.com', code });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RESET_CODE_LOCKED');
  });

  it('8/12. correct OTP succeeds and yields a reset authorization', async () => {
    await seedUser('ok@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'ok@example.com' });
    const res = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'ok@example.com', code: lastCodeFor('ok@example.com') });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.resetToken).toBe('string');
    expect(res.body.data.resetToken).toContain('.');
    expect(res.body.data.expiresInMinutes).toBe(ENV.PASSWORD_RESET_TOKEN_TTL_MINUTES);
  });

  it('9. a verified OTP cannot be reused', async () => {
    await seedUser('reuse@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'reuse@example.com' });
    const code = lastCodeFor('reuse@example.com');
    expect((await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'reuse@example.com', code })).status).toBe(200);
    const again = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'reuse@example.com', code });
    expect(again.status).toBe(401);
  });

  it('10. a resent OTP invalidates the previous one', async () => {
    await seedUser('resend@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'resend@example.com' });
    const first = lastCodeFor('resend@example.com');
    // Move past the cooldown without waiting.
    for (const ch of state.challenges.values()) ch.createdAt = new Date(Date.now() - 61_000);
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'resend@example.com' });
    const second = lastCodeFor('resend@example.com');
    expect(state.sent.filter((s) => s.to === 'resend@example.com')).toHaveLength(2);
    expect((await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'resend@example.com', code: first })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'resend@example.com', code: second })).status).toBe(200);
  });

  it('11. resend cooldown is enforced authoritatively with an identical response', async () => {
    await seedUser('cool@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'cool@example.com' });
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'cool@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe(GENERIC);
    expect(state.sent.filter((s) => s.to === 'cool@example.com')).toHaveLength(1);
  });

  it('13/14. reset authorization expires and is single-use', async () => {
    await seedUser('single@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'single@example.com' });
    const v = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'single@example.com', code: lastCodeFor('single@example.com') });
    const token: string = v.body.data.resetToken;
    // Expired authorization is refused.
    const challengeId = token.split('.')[0];
    state.challenges.get(challengeId).resetTokenExpiresAt = new Date(Date.now() - 1000);
    const expired = await request(app).post('/api/v1/auth/reset-password').send({ resetToken: token, newPassword: 'NewPass1', confirmPassword: 'NewPass1' });
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('INVALID_RESET_TOKEN');
    // Fresh authorization works once, then is consumed.
    for (const ch of state.challenges.values()) ch.createdAt = new Date(Date.now() - 61_000);
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'single@example.com' });
    const v2 = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'single@example.com', code: lastCodeFor('single@example.com') });
    const token2: string = v2.body.data.resetToken;
    expect((await request(app).post('/api/v1/auth/reset-password').send({ resetToken: token2, newPassword: 'NewPass1', confirmPassword: 'NewPass1' })).status).toBe(200);
    const replay = await request(app).post('/api/v1/auth/reset-password').send({ resetToken: token2, newPassword: 'OtherPass1', confirmPassword: 'OtherPass1' });
    expect(replay.status).toBe(401);
  });

  it('15. reset cannot happen with email alone', async () => {
    const app = createTestApp();
    const noToken = await request(app).post('/api/v1/auth/reset-password').send({ email: 'x@example.com', newPassword: 'NewPass1', confirmPassword: 'NewPass1' } as any);
    expect(noToken.status).toBe(400);
    const garbage = await request(app).post('/api/v1/auth/reset-password').send({ resetToken: 'bogus.token.value.here', newPassword: 'NewPass1', confirmPassword: 'NewPass1' });
    expect(garbage.status).toBe(401);
  });

  it('16/17/18/19/20/23. full reset: policy, hashing, login rotation, session invalidation, no duplicates', async () => {
    const user = await seedUser('full@example.com', await hashPassword('OldPass1'));
    const other = await seedUser('other@example.com', await hashPassword('OtherPass1'));
    state.sessions.set('s1', { id: 's1', tokenHash: 'h1', userId: user.id, expiresAt: new Date(Date.now() + 99999) });
    state.sessions.set('s2', { id: 's2', tokenHash: 'h2', userId: other.id, expiresAt: new Date(Date.now() + 99999) });
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'full@example.com' });
    const v = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'full@example.com', code: lastCodeFor('full@example.com') });

    const weak = await request(app).post('/api/v1/auth/reset-password').send({ resetToken: v.body.data.resetToken, newPassword: 'short', confirmPassword: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('WEAK_PASSWORD');

    const mismatch = await request(app).post('/api/v1/auth/reset-password').send({ resetToken: v.body.data.resetToken, newPassword: 'NewPass1', confirmPassword: 'Different1' });
    expect(mismatch.status).toBe(400);

    const done = await request(app).post('/api/v1/auth/reset-password').send({ resetToken: v.body.data.resetToken, newPassword: 'NewPass1', confirmPassword: 'NewPass1' });
    expect(done.status).toBe(200);

    const stored = state.users.get(user.id)!;
    expect(stored.passwordHash).not.toBe('NewPass1');
    expect(stored.email).toBe('full@example.com');

    expect((await request(app).post('/api/v1/auth/login').send({ email: 'full@example.com', password: 'OldPass1' })).status).toBe(401);

    // Sessions were invalidated by the reset (checked before logging in
    // again, which legitimately creates a fresh session).
    expect([...state.sessions.values()].some((s) => s.userId === user.id)).toBe(false);
    expect([...state.sessions.values()].some((s) => s.userId === other.id)).toBe(true);

    expect((await request(app).post('/api/v1/auth/login').send({ email: 'full@example.com', password: 'NewPass1' })).status).toBe(200);

    expect(state.users.size).toBe(2);
  });

  it('21. Google-only account (passwordHash null) can establish its first password', async () => {
    await seedUser('googleonly@example.com', null);
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'googleonly@example.com' });
    expect(state.sent).toHaveLength(1);
    const v = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'googleonly@example.com', code: lastCodeFor('googleonly@example.com') });
    expect(v.status).toBe(200);
    const done = await request(app).post('/api/v1/auth/reset-password').send({ resetToken: v.body.data.resetToken, newPassword: 'FirstPass1', confirmPassword: 'FirstPass1' });
    expect(done.status).toBe(200);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'googleonly@example.com', password: 'FirstPass1' })).status).toBe(200);
    expect(state.users.size).toBe(1);
  });

  it('22. Google sign-in still works after a password reset (regression)', async () => {
    const user = await seedUser('guser@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'guser@example.com' });
    const v = await request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'guser@example.com', code: lastCodeFor('guser@example.com') });
    await request(app).post('/api/v1/auth/reset-password').send({ resetToken: v.body.data.resetToken, newPassword: 'NewPass1', confirmPassword: 'NewPass1' });

    const realClientId = ENV.GOOGLE_CLIENT_ID;
    ENV.GOOGLE_CLIENT_ID = 'test-client';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        aud: 'test-client',
        exp: String(Math.floor(Date.now() / 1000) + 3600),
        email: 'guser@example.com',
        email_verified: 'true',
        sub: 'google-sub-1',
        name: 'G User',
      }),
    })));
    try {
      const res = await request(app).post('/api/v1/auth/google').send({ credential: 'valid-credential-value-1234567890' });
      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(user.id);
      expect(state.users.size).toBe(1);
    } finally {
      ENV.GOOGLE_CLIENT_ID = realClientId;
    }
  });

  it('25/26. email misconfiguration keeps the generic response and leaks nothing', async () => {
    await seedUser('cfg@example.com', await hashPassword('OldPass1'));
    state.setEmailMode('fail');
    const app = createTestApp();
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'cfg@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe(GENERIC);
    expect(state.challenges.size).toBe(1);

    state.setEmailMode('leak');
    for (const ch of state.challenges.values()) ch.createdAt = new Date(Date.now() - 61_000);
    const res2 = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'cfg@example.com' });
    expect(res2.status).toBe(200);
    expect(JSON.stringify(res2.body)).not.toContain('SECRET_SIM');
    expect(JSON.stringify(res2.body)).not.toContain('123456');
  });

  it('27. IP-level rate limiting is wired on the reset endpoints', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    let last = 200;
    for (let i = 0; i < 12; i++) {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: `probe${i}@example.com` });
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it('28. concurrent verification of one OTP yields exactly one success', async () => {
    await seedUser('race@example.com', await hashPassword('OldPass1'));
    const app = createTestApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'race@example.com' });
    const code = lastCodeFor('race@example.com');
    const [a, b] = await Promise.all([
      request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'race@example.com', code }),
      request(app).post('/api/v1/auth/verify-reset-code').send({ email: 'race@example.com', code }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });
});
