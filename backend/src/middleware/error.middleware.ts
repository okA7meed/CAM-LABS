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

  return ApiResponseHelper.error(
    res,
    'INTERNAL_SERVER_ERROR',
    'An unexpected manufacturing system error occurred',
    500
  );
};
