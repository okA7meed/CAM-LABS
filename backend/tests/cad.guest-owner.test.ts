import express, { Express, Request, Response } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { GUEST_CAD_COOKIE, resolveCadOwner } from '../src/middleware/auth.middleware';

const GUEST_ID_A = '3f6f9b71-5a47-4b9e-9f1c-3c2e2f6a1c5d';
const GUEST_ID_B = '7c1d8a30-0e2b-4d6f-9b3a-c4d5e6f7a8b9';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ownerEchoApp = (): Express => {
  const app = express();
  app.use('/owner', resolveCadOwner);
  app.get('/owner', (req: Request, res: Response) => {
    res.json({ cadOwner: req.cadOwner });
  });
  return app;
};

const cookieFor = (id: string): string => `${GUEST_CAD_COOKIE}=${id}`;

describe('resolveCadOwner guest identity', () => {
  it('adopts a validated X-Cad-Guest-Id header when no cookie is present', async () => {
    const response = await request(ownerEchoApp()).get('/owner').set('X-Cad-Guest-Id', GUEST_ID_A);
    expect(response.status).toBe(200);
    expect(response.body.cadOwner).toEqual({ guestId: GUEST_ID_A });
    expect(response.headers['set-cookie']?.[0] ?? '').toContain(cookieFor(GUEST_ID_A));
  });

  it('does not re-send the cookie when the header matches the stored cookie', async () => {
    const response = await request(ownerEchoApp())
      .get('/owner')
      .set('X-Cad-Guest-Id', GUEST_ID_A)
      .set('Cookie', cookieFor(GUEST_ID_A));
    expect(response.status).toBe(200);
    expect(response.body.cadOwner).toEqual({ guestId: GUEST_ID_A });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a malformed header and falls back to the cookie identity', async () => {
    const response = await request(ownerEchoApp())
      .get('/owner')
      .set('X-Cad-Guest-Id', 'not-a-uuid')
      .set('Cookie', cookieFor(GUEST_ID_B));
    expect(response.status).toBe(200);
    expect(response.body.cadOwner).toEqual({ guestId: GUEST_ID_B });
  });

  it('issues a fresh stable id when neither header nor cookie is provided', async () => {
    const response = await request(ownerEchoApp()).get('/owner');
    expect(response.status).toBe(200);
    const { guestId } = response.body.cadOwner as { guestId: string };
    expect(guestId).toMatch(UUID_PATTERN);
    expect(response.headers['set-cookie']?.[0] ?? '').toContain(`${GUEST_CAD_COOKIE}=${guestId}`);
  });
});