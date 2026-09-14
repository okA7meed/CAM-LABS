import { Request, Response, NextFunction } from 'express';
import { setSecureCookie } from '../utils/cookies';
import { ApiResponseHelper } from '../utils/response';
import { extractSessionToken, resolveSession } from '../auth/session.service';

export const GUEST_CAD_COOKIE = 'cam_labs_guest_cad';
/* Header the frontend uses to keep guest CAD ownership stable across the
   parallel upload/poll/geometry burst, independent of when a Set-Cookie can be
   committed (fixes the multi-file race that scattered files across owners). */
export const GUEST_CAD_HEADER = 'x-cad-guest-id';

const GUEST_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24;
const RESOLVED_GUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidGuestId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && RESOLVED_GUEST_ID.test(value);

export const getGuestCadId = (cookieHeader?: string): string | undefined => {
  const value = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${GUEST_CAD_COOKIE}=`))?.slice(GUEST_CAD_COOKIE.length + 1);
  return isValidGuestId(value) ? value : undefined;
};

export const getGuestCadHeaderId = (req: Request): string | undefined => {
  const raw = req.headers[GUEST_CAD_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isValidGuestId(value) ? value : undefined;
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
    let guestId = getGuestCadHeaderId(req) || getGuestCadId(req.headers.cookie);
    if (!guestId) {
      guestId = crypto.randomUUID();
      setSecureCookie(res, GUEST_CAD_COOKIE, guestId, { maxAge: GUEST_COOKIE_MAX_AGE });
    } else if (getGuestCadId(req.headers.cookie) !== guestId) {
      // Keep the cookie in sync with the header-issued identity so requests
      // without the header (e.g. across tabs) resolve to the same owner.
      setSecureCookie(res, GUEST_CAD_COOKIE, guestId, { maxAge: GUEST_COOKIE_MAX_AGE });
    }
    req.cadOwner = { guestId };
    next();
  } catch (error) {
    next(error);
  }
};