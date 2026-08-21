import bcrypt from 'bcryptjs';

const PASSWORD_ROUNDS = 12;

export const validatePassword = (password: string): string | null => {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include uppercase, lowercase, and numeric characters.';
  }
  return null;
};

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, PASSWORD_ROUNDS);

export const verifyPassword = (password: string, passwordHash: string): Promise<boolean> =>
  bcrypt.compare(password, passwordHash);