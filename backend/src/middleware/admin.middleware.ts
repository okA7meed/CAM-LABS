import { NextFunction, Request, Response } from 'express';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './authorization.middleware';
import { ROLES, Role, hasRole } from '../auth/roles';
import { ApiResponseHelper } from '../utils/response';

/**
 * Require specific admin roles.
 * Authenticates the request first (401 when unauthenticated), then enforces
 * the role rank (403 when the authenticated user lacks the required role).
 * This guarantees every admin route is authenticated even if a route omits
 * an explicit `requireAuth` call.
 */
export const requireAdminRole = (...roles: Role[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await requireAuth(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      if (!req.auth || !hasRole(req.auth.role, roles)) {
        ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to perform this action.', 403);
        return;
      }
      next();
    });
  };

/**
 * Super Admin only - full access
 */
export const requireSuperAdmin = requireAdminRole(ROLES.SUPER_ADMIN);

/**
 * Operations Admin - orders, manufacturing, shipping
 */
export const requireOperationsAdmin = requireAdminRole(ROLES.OPERATIONS_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN);

/**
 * Pricing Admin - pricing, equations, materials
 */
export const requirePricingAdmin = requireAdminRole(ROLES.PRICING_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN);

/**
 * Support Admin - customers, orders, quotes
 */
export const requireSupportAdmin = requireAdminRole(ROLES.SUPPORT_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN);

/**
 * Finance Admin - payments, revenue
 */
export const requireFinanceAdmin = requireAdminRole(ROLES.FINANCE_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN);

/**
 * Check if user has admin access (any admin role)
 */
export const requireAnyAdmin = requireAdminRole(
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
  ROLES.OPERATIONS_ADMIN,
  ROLES.PRICING_ADMIN,
  ROLES.SUPPORT_ADMIN,
  ROLES.FINANCE_ADMIN
);

/**
 * Generic admin gate (any admin role). Historically this ONLY authenticated
 * (a trap for callers who assumed they were adding an admin check) — it now
 * genuinely requires ANY admin role.
 */
export const requireAdmin = requireAnyAdmin;