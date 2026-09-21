import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { AppError } from '../utils/errors';

/**
 * Canonical phone handling (CAM LABS account/phone unification).
 *
 * Canonical storage is E.164 (`+201012345678`). The parser is
 * backward-compatible with every format previously accepted by the loose
 * regex validator (`+20 1043263308`, `01233551516`, `+1 (415) 890-2144`,
 * bare local numbers): anything libphonenumber can interpret — with Egypt
 * as the default country for national numbers — normalizes to E.164.
 * Truly uninterpretable values are rejected with a UX-safe error code;
 * the frontend maps codes to localized messages.
 */

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'EG';

export type PhoneValidationCode =
  | 'PHONE_INVALID'
  | 'PHONE_TOO_SHORT'
  | 'PHONE_TOO_LONG';

export interface NormalizedPhone {
  /** E.164 canonical form, e.g. `+201012345678`. */
  e164: string;
  /** ISO 3166-1 alpha-2 country, e.g. `EG`. */
  country: CountryCode;
  /** National (subscriber) number as typed within its country. */
  national: string;
}

const lengthCode = (digits: number): PhoneValidationCode =>
  digits < 7 ? 'PHONE_TOO_SHORT' : 'PHONE_TOO_LONG';

/**
 * Parses any previously-stored or user-typed value. Returns null when the
 * value cannot be interpreted as a phone number at all.
 */
export const parseStoredPhone = (
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): NormalizedPhone | null => {
  const raw = (input || '').trim();
  if (!raw) return null;
  // Fast path: already canonical E.164.
  if (/^\+\d{7,15}$/.test(raw.replace(/[\s()-]/g, ''))) {
    const compact = raw.replace(/[\s()-]/g, '');
    try {
      const parsed = parsePhoneNumberFromString(compact);
      if (parsed && parsed.isValid()) {
        return { e164: parsed.number as string, country: parsed.country as CountryCode, national: parsed.nationalNumber as string };
      }
    } catch {
      /* fall through to general parsing */
    }
  }
  try {
    const parsed = parsePhoneNumberFromString(raw, defaultCountry);
    if (!parsed) return null;
    // Accept possible-but-not-strictly-valid numbers on READ (backward
    // compatibility with legacy stored values); writes require validity.
    return {
      e164: (parsed.isValid() ? parsed.number : `+${parsed.countryCallingCode}${parsed.nationalNumber}`) as string,
      country: (parsed.country || defaultCountry) as CountryCode,
      national: parsed.nationalNumber as string,
    };
  } catch {
    return null;
  }
};

/**
 * Validates a user-supplied number for WRITE paths (registration, profile).
 * Throws an AppError carrying a stable UX-safe code. On success returns the
 * canonical E.164 value to persist.
 */
export const normalizePhoneForWrite = (
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string => {
  const raw = (input || '').trim();
  if (!raw) throw new AppError('A valid phone number is required.', 400, 'PHONE_INVALID');
  let parsed;
  try {
    parsed = parsePhoneNumberFromString(raw, defaultCountry);
  } catch {
    parsed = undefined;
  }
  if (!parsed) {
    const digits = raw.replace(/\D/g, '').length;
    throw new AppError('This phone number is not valid for the selected country.', 400, lengthCode(digits));
  }
  if (!parsed.isPossible()) {
    throw new AppError(
      parsed.nationalNumber.length < 7 ? 'This phone number is too short.' : 'This phone number is too long.',
      400,
      lengthCode(parsed.nationalNumber.length),
    );
  }
  if (!parsed.isValid()) {
    throw new AppError('This phone number is not valid for the selected country.', 400, 'PHONE_INVALID');
  }
  return parsed.number as string;
};
