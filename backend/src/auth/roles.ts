export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  MAKER: 'MAKER',
  ENGINEER: 'ENGINEER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  OPERATIONS_ADMIN: 'OPERATIONS_ADMIN',
  PRICING_ADMIN: 'PRICING_ADMIN',
  SUPPORT_ADMIN: 'SUPPORT_ADMIN',
  FINANCE_ADMIN: 'FINANCE_ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 10,
  MAKER: 20,
  ENGINEER: 30,
  SUPPORT_ADMIN: 35,
  FINANCE_ADMIN: 36,
  PRICING_ADMIN: 37,
  OPERATIONS_ADMIN: 38,
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