import { describe, expect, it } from 'vitest';
import { hasRole, isRole, normalizeRole, ROLES } from '../src/auth/roles';
import { toSafeUser } from '../src/auth/types';

const allRoles = Object.values(ROLES);

describe('normalizeRole', () => {
  it('preserves every valid role', () => {
    for (const role of allRoles) {
      expect(normalizeRole(role)).toBe(role);
    }
  });

  it('falls back to CUSTOMER for invalid or undefined values', () => {
    expect(normalizeRole('UNKNOWN_ROLE')).toBe('CUSTOMER');
    expect(normalizeRole('')).toBe('CUSTOMER');
    expect(normalizeRole(undefined)).toBe('CUSTOMER');
  });
});

describe('isRole', () => {
  it('accepts only members of ROLES', () => {
    expect(isRole('ADMIN')).toBe(true);
    expect(isRole('PRICING_ADMIN')).toBe(true);
    expect(isRole('super_admin')).toBe(false);
    expect(isRole('ROOT')).toBe(false);
  });
});

describe('hasRole (rank semantics)', () => {
  it('a role satisfies requirements at or below its rank', () => {
    expect(hasRole('SUPER_ADMIN', ['SUPER_ADMIN'])).toBe(true);
    expect(hasRole('SUPER_ADMIN', ['PRICING_ADMIN'])).toBe(true);
    expect(hasRole('ADMIN', ['SUPER_ADMIN'])).toBe(false);
    expect(hasRole('CUSTOMER', ['ADMIN'])).toBe(false);
    expect(hasRole('MAKER', ['CUSTOMER'])).toBe(true);
  });
});

describe('toSafeUser role normalization', () => {
  const baseUser = {
    id: 'user-1',
    name: 'Admin',
    email: 'admin@example.com',
    accountStatus: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: '',
  };

  it('keeps specialized admin roles so admin sessions survive /auth/me', () => {
    for (const role of ['PRICING_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN']) {
      const safe = toSafeUser({ ...baseUser, role });
      expect(safe.role).toBe(role);
    }
  });

  it('normalizes an unknown stored role to CUSTOMER', () => {
    const safe = toSafeUser({ ...baseUser, role: 'GHOST_ADMIN' as string });
    expect(safe.role).toBe('CUSTOMER');
  });
});