import { NextFunction, Request, Response } from 'express';
import { Role, hasRole } from '../auth/roles';
import { ApiResponseHelper } from '../utils/response';

export const requireRoles = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.auth || !hasRole(req.auth.role, roles)) {
    ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to perform this action.', 403);
    return;
  }
  next();
};

export const requireOwnerOrRole = (getOwnerId: (req: Request) => string | undefined, ...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      ApiResponseHelper.error(res, 'UNAUTHENTICATED', 'Authentication is required.', 401);
      return;
    }
    if (req.auth.id !== getOwnerId(req) && !hasRole(req.auth.role, roles)) {
      ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
      return;
    }
    next();
  };