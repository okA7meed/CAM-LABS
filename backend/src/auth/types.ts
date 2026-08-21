import { Role } from './roles';

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

export const toSafeUser = (user: Omit<AuthenticatedUser, 'role'> & { role: string; passwordHash?: string | null }): AuthenticatedUser => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    role: normalizeRoleForResponse(user.role),
  };
};

const normalizeRoleForResponse = (role: string): Role => {
  switch (role) {
    case 'MAKER':
    case 'ENGINEER':
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return role;
    default:
      return 'CUSTOMER';
  }
};