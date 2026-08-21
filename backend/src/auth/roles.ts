export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  MAKER: 'MAKER',
  ENGINEER: 'ENGINEER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 10,
  MAKER: 20,
  ENGINEER: 30,
  ADMIN: 40,
  SUPER_ADMIN: 50,
};

export const isRole = (value: string): value is Role => value in ROLE_RANK;

export const hasRole = (actualRole: string, requiredRoles: readonly Role[]): boolean => {
  if (!isRole(actualRole)) return false;
  return requiredRoles.some((requiredRole) => ROLE_RANK[actualRole] >= ROLE_RANK[requiredRole]);
};

export const normalizeRole = (value: string | undefined): Role => {
  if (value && isRole(value)) return value;
  return ROLES.CUSTOMER;
};