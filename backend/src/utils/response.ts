import { Response } from 'express';

export class ApiResponseHelper {
  static success<T>(res: Response, data: T, message: string = 'Success', statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  static error(res: Response, code: string, message: string, statusCode: number = 400, details?: unknown) {
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
