import { Logger } from './logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * Sends a safe error response for a route handler.
 *
 * - AppError instances carry a deliberate HTTP status + message and are
 *   surfaced to the caller unchanged (business/validation errors).
 * - Everything else (Prisma/SQL/internal surprises) is logged server-side
 *   and replaced by a generic 500 so database internals, stack traces, and
 *   filesystem paths are never leaked to API clients.
 */
export const sendSafeRouteError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res: import('express').Response,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  err: any,
  fallback: { code: string; message: string; status?: number }
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  Logger.error(
    '[Route] Unhandled error (detail not returned to client):',
    err instanceof Error ? `${err.message}${err.stack ? `\n${err.stack}` : ''}` : String(err)
  );
  res.status(fallback.status || 500).json({
    success: false,
    error: { code: fallback.code, message: fallback.message },
    timestamp: new Date().toISOString(),
  });
};
