import { describe, expect, it } from 'vitest';
import {
  formatIp,
  getDefaultAddress,
  getInitials,
  parseUserAgent,
  truncateMiddle,
} from './accountUtils';
import { detectCountry, parsePhone, validatePhone } from '../phone/phoneLib';
import { User } from '../../types';

describe('account initials', () => {
  it('derives two-letter initials from multi-word names', () => {
    expect(getInitials('Ahmed Khaled')).toBe('AK');
    expect(getInitials('John Smith')).toBe('JS');
  });

  it('handles single-word, empty, and unicode names', () => {
    expect(getInitials('John')).toBe('JO');
    expect(getInitials('')).toBe('U');
    expect(getInitials('   ')).toBe('U');
    expect(getInitials(null)).toBe('U');
    // Arabic glyphs pass through upper-casing unchanged.
    expect(getInitials('أحمد خالد')).toBe('أخ');
  });
});

describe('libphonenumber phone handling', () => {
  it('normalizes legacy stored formats to E.164', () => {
    expect(parsePhone('+20 1043263308')?.e164).toBe('+201043263308');
    expect(parsePhone('01233551516')?.e164).toBe('+201233551516');
    expect(parsePhone('+201234567890')?.e164).toBe('+201234567890');
    expect(parsePhone('+1 (415) 890-2144')?.e164).toBe('+14158902144');
    expect(parsePhone('not-a-number')).toBeNull();
  });

  it('detects the country of stored values', () => {
    expect(detectCountry('+20 1043263308')).toBe('EG');
    expect(detectCountry('+1 (415) 890-2144')).toBe('US');
    expect(detectCountry('1043263308')).toBe('EG');
  });

  it('validates Egyptian mobile patterns country-aware', () => {
    expect(validatePhone('1012345678', 'EG').e164).toBe('+201012345678');
    expect(validatePhone('1223355151', 'EG').e164).toBe('+201223355151');
    expect(validatePhone('12345', 'EG').error).toBe('too-short');
    expect(validatePhone('101234567890123', 'EG').error).toBe('too-long');
    expect(validatePhone('2123456789', 'EG').error).toBe('invalid');
    expect(validatePhone('1012345678', 'US').error).not.toBeNull();
  });
});

describe('address book helpers', () => {
  const user = {
    preferences: {
      addressBook: [
        { id: 'a1', label: 'Home', street: 'Main Street', city: 'Kharga', governorate: 'New Valley' },
        { id: 'a2', label: 'Work', street: 'Smart Village', city: 'Giza', governorate: 'Giza' },
      ],
      defaultAddressId: 'a2',
    },
  } as unknown as User;

  it('resolves the default address entry', () => {
    expect(getDefaultAddress(user)?.id).toBe('a2');
    expect(getDefaultAddress(null)).toBeNull();
  });

  it('truncates long identifiers without breaking short ones', () => {
    expect(truncateMiddle('short@mail.com')).toBe('short@mail.com');
    expect(truncateMiddle('a18.gfx0.very.long.address@gmail.com')).toContain('...');
  });
});

describe('session display helpers', () => {
  it('parses common user agents', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0 Safari/537.36')).toEqual({
      os: 'macOS',
      browser: 'Chrome',
    });
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari/604.1')).toEqual({
      os: 'iOS',
      browser: 'Safari',
    });
    expect(parseUserAgent(null)).toEqual({ os: null, browser: null });
  });

  it('formats stored IPs honestly', () => {
    expect(formatIp('192.168.1.1')).toBe('192.168.1.1');
    expect(formatIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
    expect(formatIp(null)).toBeNull();
  });
});
