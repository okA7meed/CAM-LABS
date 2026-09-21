import {
  CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

/**
 * Shared country-aware phone utilities (single strategy for registration,
 * Account Settings, and anywhere else a phone number is collected).
 *
 * - Country list is derived from libphonenumber metadata (never hand-written)
 *   with localized names via `Intl.DisplayNames` and computed flag glyphs.
 * - Canonical value exchanged with the API is E.164 (`+201012345678`).
 * - Legacy stored values (`+20 1043263308`, `01233551516`, …) are parsed
 *   best-effort for display; writes always normalize through libphonenumber,
 *   and the server re-validates independently.
 */

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'EG';

export type PhoneErrorCode = 'invalid' | 'too-short' | 'too-long' | null;

export interface CountryOption {
  iso: CountryCode;
  name: string;
  code: string;
  flag: string;
}

export const countryFlag = (iso: string): string =>
  String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));

const collatorCache = new Map<string, Intl.Collator>();

export function getCountryOptions(locale: string): CountryOption[] {
  const base = locale.startsWith('ar') ? 'ar' : 'en';
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames([base], { type: 'region' });
  } catch {
    display = null;
  }
  const options = getCountries().map((iso) => {
    let code = '';
    try {
      code = `+${getCountryCallingCode(iso)}`;
    } catch {
      code = '';
    }
    return {
      iso,
      name: display?.of(iso) || iso,
      code,
      flag: countryFlag(iso),
    };
  }).filter((c) => c.code);
  const collator = collatorCache.get(base) || new Intl.Collator(base);
  collatorCache.set(base, collator);
  return options.sort((a, b) => collator.compare(a.name, b.name));
}

export interface ParsedPhone {
  e164: string;
  country: CountryCode;
  national: string;
}

/** Best-effort parse of any stored/typed value (never throws). */
export function parsePhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): ParsedPhone | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  try {
    const parsed = parsePhoneNumberFromString(raw, defaultCountry);
    if (!parsed) return null;
    const country = (parsed.country || defaultCountry) as CountryCode;
    const e164 = parsed.isValid() ? (parsed.number as string) : `+${parsed.countryCallingCode}${parsed.nationalNumber}`;
    return { e164, country, national: parsed.nationalNumber as string };
  } catch {
    return null;
  }
}

/**
 * Strict validation for WRITE paths. Returns the canonical E.164 value plus
 * a UX-safe error code (null when valid) for localized messaging.
 */
export function validatePhone(
  nationalInput: string,
  country: CountryCode,
): { e164: string | null; error: PhoneErrorCode } {
  const raw = (nationalInput || '').trim();
  if (!raw) return { e164: null, error: 'invalid' };
  let parsed;
  try {
    parsed = parsePhoneNumberFromString(raw, country);
  } catch {
    parsed = undefined;
  }
  if (!parsed) {
    const digits = raw.replace(/\D/g, '').length;
    return { e164: null, error: digits > 0 && digits < 7 ? 'too-short' : 'invalid' };
  }
  if (!parsed.isPossible()) {
    return { e164: null, error: parsed.nationalNumber.length < 7 ? 'too-short' : 'too-long' };
  }
  if (!parsed.isValid()) return { e164: null, error: 'invalid' };
  return { e164: parsed.number as string, error: null };
}

/** Detects the most likely country for a stored value (for preselection). */
export function detectCountry(
  input: string | null | undefined,
  fallback: CountryCode = DEFAULT_PHONE_COUNTRY,
): CountryCode {
  return parsePhone(input, fallback)?.country || fallback;
}
