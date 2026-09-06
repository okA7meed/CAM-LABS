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
  user: Omit<AuthenticatedUser, 'role'> & { role: string; passwordHash?: string | null; isAdmin?: boolean }
): AuthenticatedUser => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  let role = normalizeRoleForResponse(user.role);
  if (role === 'CUSTOMER' && user.isAdmin) {
    role = 'ADMIN';
  }
  return {
    ...safeUser,
    role,
  };
};

const normalizeRoleForResponse = (role: string): Role => normalizeRole(role);