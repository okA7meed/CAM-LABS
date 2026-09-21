import { normalizeRole, Role } from './roles';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  accountStatus: string;
  company: string;
  phone: string | null;
  avatar: string | null;
  tier: string;
  address: string | null;
  taxId: string | null;
  preferences: unknown;
  twoFactorEnabled: boolean;
  /** Whether a password credential exists (false for OAuth-only accounts). */
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequestUser extends AuthenticatedUser {
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedRequestUser;
      cadOwner?: { userId?: string; guestId?: string };
    }
  }
}

export const toSafeUser = (
  user: Omit<AuthenticatedUser, 'role' | 'hasPassword'> & {
    role: string;
    passwordHash?: string | null;
    isAdmin?: boolean;
    // Stable Google subject — server-only identity linkage, never exposed.
    googleSub?: string | null;
    // Server-only 2FA material — stripped from every API response.
    twoFactorSecret?: string | null;
    twoFactorPendingSecret?: string | null;
    twoFactorPendingExpiresAt?: Date | null;
    twoFactorBackupCodes?: unknown;
  }
): AuthenticatedUser => {
  const {
    passwordHash,
    googleSub: _googleSub,
    twoFactorSecret: _twoFactorSecret,
    twoFactorPendingSecret: _twoFactorPendingSecret,
    twoFactorPendingExpiresAt: _twoFactorPendingExpiresAt,
    twoFactorBackupCodes: _twoFactorBackupCodes,
    ...safeUser
  } = user;
  let role = normalizeRoleForResponse(user.role);
  if (role === 'CUSTOMER' && user.isAdmin) {
    role = 'ADMIN';
  }
  return {
    ...safeUser,
    twoFactorEnabled: Boolean((user as { twoFactorEnabled?: boolean }).twoFactorEnabled),
    hasPassword: Boolean(passwordHash),
    role,
  };
};

const normalizeRoleForResponse = (role: string): Role => normalizeRole(role);