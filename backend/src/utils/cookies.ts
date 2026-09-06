import { CookieOptions, Response } from 'express';

/**
 * Set a cookie with common security defaults.
 * Options can be overridden by providing a partial Options object.
 */
export const setSecureCookie = (
  res: Response,
  name: string,
  value: string,
  options?: CookieOptions
): void => {
  const defaults = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  };
  res.cookie(name, value, { ...defaults, ...options });
};

/**
 * Clear a cookie securely.
 */
export const clearSecureCookie = (res: Response, name: string): void => {
  res.clearCookie(name, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
};
