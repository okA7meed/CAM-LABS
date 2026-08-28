import { getPrismaClient } from '../config/database';
import { verifyPassword, hashPassword, validatePassword } from '../auth/password.service';
import { createSession } from '../auth/session.service';
import { ROLES } from '../auth/roles';
import { AppError } from '../utils/errors';
import { AdminService } from './admin.service';

/**
 * Admin Authentication Service
 * 
 * Handles admin-specific authentication including:
 * - Admin login with role verification
 * - Account lockout after failed attempts
 * - Session management for admins
 * - Password requirements for admin accounts
 */

export class AdminAuthService {
  /**
   * Admin login with role verification
   */
  static async adminLogin(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const prisma = getPrismaClient();
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is admin
    if (!user.isAdmin) {
      throw new AppError('Access denied. Admin access required.', 403, 'NOT_ADMIN');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('Account temporarily locked due to too many failed attempts. Please try again later.', 423, 'ACCOUNT_LOCKED');
    }

    // Check account status
    if (user.accountStatus !== 'ACTIVE') {
      throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    // Verify password
    const validPassword = user.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
    if (!validPassword) {
      // Increment failed login attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updateData: any = { failedLoginAttempts: failedAttempts };

      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Reset failed login attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    // Create session
    const session = await createSession(user.id);

    // Create audit log
    await AdminService.createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      ipAddress,
      userAgent,
      sessionId: session.sessionId,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        accountStatus: user.accountStatus,
      },
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

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