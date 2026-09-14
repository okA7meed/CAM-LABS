import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ApiResponseHelper } from '../utils/response';
import { Logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  Logger.error('Unhandled API Exception:', err.message, err.stack);

  if (err instanceof AppError) {
    return ApiResponseHelper.error(res, err.code, err.message, err.statusCode);
  }

  // body-parser / express.raw oversized payload (413). Surface a clean,
  // machine-readable response instead of a generic 500.
  const bodyParserError = err as Error & { type?: string; status?: number };
  if (bodyParserError.type === 'entity.too.large' || bodyParserError.type === 'encoding.unsupported') {
    return ApiResponseHelper.error(res, 'PAYLOAD_TOO_LARGE', 'The upload exceeds the maximum allowed size.', 413);
  }

  return ApiResponseHelper.error(
    res,
    'INTERNAL_SERVER_ERROR',
    'An unexpected manufacturing system error occurred',
    500
  );
};
