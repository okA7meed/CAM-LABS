import { NextFunction, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { extractSessionToken, resolveSession } from '../auth/session.service';

export const GUEST_CAD_COOKIE = 'cam_labs_guest_cad';

export const getGuestCadId = (cookieHeader?: string): string | undefined => {
  const value = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${GUEST_CAD_COOKIE}=`))?.slice(GUEST_CAD_COOKIE.length + 1);
  return value && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value) ? value : undefined;
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractSessionToken(req.headers.cookie, req.headers.authorization);
    if (!token) {
      ApiResponseHelper.error(res, 'UNAUTHENTICATED', 'Authentication is required.', 401);
      return;
    }

    const user = await resolveSession(token);
    if (!user) {
      ApiResponseHelper.error(res, 'UNAUTHENTICATED', 'Authentication is required.', 401);
      return;
    }

    req.auth = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const resolveCadOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractSessionToken(req.headers.cookie, req.headers.authorization);
    const user = token ? await resolveSession(token) : null;
    if (user) {
      req.auth = user;
      req.cadOwner = { userId: user.id };
      next();
      return;
    }
    let guestId = getGuestCadId(req.headers.cookie);
    if (!guestId) {
      guestId = crypto.randomUUID();
      res.cookie(GUEST_CAD_COOKIE, guestId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 });
    }
    req.cadOwner = { guestId };
    next();
  } catch (error) {
    next(error);
  }
};