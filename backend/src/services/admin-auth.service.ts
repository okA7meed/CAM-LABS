import { ROLES } from '../auth/roles';

/**
 * Admin Authentication Service
 * 
 * Provides admin password policy enforcement and role/permission helpers used
 * by the admin panel. Admins authenticate through the same normal website
 * login as every other user; their role decides what they can access.
 */

export class AdminAuthService {
  /**
   * Validate admin password requirements
   */
  static validateAdminPassword(password: string): { valid: boolean; error?: string } {
    // Admin-specific password requirements (stricter than regular users)
    if (password.length < 12) {
      return { valid: false, error: 'Admin passwords must be at least 12 characters long' };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Admin passwords must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Admin passwords must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Admin passwords must contain at least one number' };
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { valid: false, error: 'Admin passwords must contain at least one special character' };
    }

    return { valid: true };
  }

  /**
   * Check if user has required admin role
   */
  static hasAdminRole(userRole: string, requiredRoles: string[]): boolean {
    const adminRoles = [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
      ROLES.OPERATIONS_ADMIN,
      ROLES.PRICING_ADMIN,
      ROLES.SUPPORT_ADMIN,
      ROLES.FINANCE_ADMIN,
    ];

    if (!adminRoles.includes(userRole as any)) {
      return false;
    }

    // Super Admin has all permissions
    if (userRole === ROLES.SUPER_ADMIN) {
      return true;
    }

    return requiredRoles.includes(userRole);
  }

  /**
   * Get admin permissions based on role
   */
  static getAdminPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      [ROLES.SUPER_ADMIN]: ['*'],
      [ROLES.ADMIN]: ['*'],
      [ROLES.OPERATIONS_ADMIN]: [
        'orders.read',
        'orders.write',
        'manufacturing.read',
        'manufacturing.write',
        'manufacturers.read',
        'manufacturers.write',
        'shipping.read',
        'shipping.write',
      ],
      [ROLES.PRICING_ADMIN]: [
        'pricing.read',
        'pricing.write',
        'materials.read',
        'materials.write',
        'equations.read',
        'equations.write',
      ],
      [ROLES.SUPPORT_ADMIN]: [
        'customers.read',
        'customers.write',
        'orders.read',
        'quotes.read',
        'cad_files.read',
      ],
      [ROLES.FINANCE_ADMIN]: [
        'payments.read',
        'payments.write',
        'revenue.read',
        'reports.read',
      ],
    };

    return permissions[role] || [];
  }
}