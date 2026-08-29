import React from 'react';
import { AvatarColor, AVATAR_COLORS, User } from '../../types';

export const AVATAR_COLOR_VALUES: Record<AvatarColor, string> = {
  blue: 'var(--cam-blue-primary)',
  red: 'var(--cam-danger)',
  green: 'var(--cam-success)',
  purple: '#8B5CF6',
  orange: '#F97316',
  yellow: '#F59E0B',
};

export interface UserAvatarProps {
  name: string;
  color?: AvatarColor;
  size?: 'sm' | 'md' | 'lg';
}

const ARABIC_LETTER = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Extract the first meaningful character from a user's display name.
 * Supports both English and Arabic names. Falls back to a neutral "U"
 * only when no usable character is present.
 */
export function getAvatarInitial(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'U';
  const first = Array.from(trimmed)[0];
  // Arabic letters are unaffected by toUpperCase() (returns the same glyph).
  return first.toUpperCase();
}

export function isArabicName(name: string): boolean {
  return ARABIC_LETTER.test((name || '').trim());
}

export function getUserAvatarColor(user: Pick<User, 'preferences'> | null | undefined): AvatarColor {
  const preferred = user?.preferences?.avatarColor;
  if (preferred && AVATAR_COLORS.includes(preferred)) return preferred;
  return 'blue';
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ name, color = 'blue', size = 'sm' }) => {
  return (
    <span
      className={`user-avatar user-avatar-${size} avatar-${color}`}
      aria-hidden="true"
      data-initial={getAvatarInitial(name)}
    >
      {getAvatarInitial(name)}
    </span>
  );
};
