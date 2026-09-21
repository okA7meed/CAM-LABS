import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CountryCode } from 'libphonenumber-js';
import { useTranslation } from 'react-i18next';
import { Icon } from '../ui/Icon';
import {
  DEFAULT_PHONE_COUNTRY,
  detectCountry,
  getCountryOptions,
  parsePhone,
  validatePhone,
} from './phoneLib';

export interface PhoneValue {
  /** Canonical E.164 value, or null while the input is not a valid number. */
  e164: string | null;
  /** Raw national input as typed (preserved for UX). */
  national: string;
  country: CountryCode;
  valid: boolean;
}

interface Props {
  id: string;
  /** Initial stored value (E.164 or any legacy format). */
  initialValue?: string | null;
  defaultCountry?: CountryCode;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
  ariaLabelledBy?: string;
  onChange: (value: PhoneValue) => void;
}

/**
 * Shared international phone input (registration + Account Settings).
 * [ national number ] [ flag + localized country name + calling code ]
 * Validation is libphonenumber-based; the parent persists `e164`.
 */
export const InternationalPhoneInput: React.FC<Props> = ({
  id,
  initialValue,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  disabled,
  autoComplete = 'tel-national',
  placeholder,
  ariaLabelledBy,
  onChange,
}) => {
  const { i18n } = useTranslation();
  const [country, setCountry] = useState<CountryCode>(() => detectCountry(initialValue, defaultCountry));
  const [national, setNational] = useState(() => parsePhone(initialValue, defaultCountry)?.national || '');
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const countries = useMemo(() => getCountryOptions(i18n.language), [i18n.language]);
  const selected = useMemo(
    () => countries.find((c) => c.iso === country) || countries.find((c) => c.iso === defaultCountry) || countries[0],
    [countries, country, defaultCountry],
  );

  const validation = useMemo(() => validatePhone(national, country), [national, country]);

  useEffect(() => {
    onChange({ e164: validation.e164, national, country, valid: validation.error === null && validation.e164 !== null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation.e164, national, country]);

  // Close the country panel on outside interaction / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    filterRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.replace('+', '').startsWith(q.replace('+', '')) || c.iso.toLowerCase() === q,
    );
  }, [countries, filter]);

  return (
    <div className="account-phone-wrap" ref={wrapRef}>
      <Icon name="phone" size={16} className="account-input-icon" />
      <input
        id={id}
        type="tel"
        className="form-control account-input account-input-bare"
        value={national}
        onChange={(e) => setNational(e.target.value)}
        autoComplete={autoComplete}
        inputMode="tel"
        dir="ltr"
        placeholder={placeholder || '1012345678'}
        disabled={disabled}
        aria-labelledby={ariaLabelledBy}
      />
      <div className="account-country">
        <button
          type="button"
          className="account-country-button"
          onClick={() => {
            setFilter('');
            setOpen((v) => !v);
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
        >
          <span className="account-country-flag" aria-hidden="true">
            {selected?.flag}
          </span>
          <span className="account-country-name">{selected?.name}</span>
          <span dir="ltr">{selected?.code}</span>
          <Icon name="chevronDown" size={14} aria-hidden="true" />
        </button>
        {open && (
          <div className="account-country-panel" role="listbox" aria-label={selected?.name}>
            <div className="account-country-search">
              <input
                ref={filterRef}
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="…"
                aria-label="filter"
                dir="auto"
              />
            </div>
            <ul className="account-country-list">
              {filtered.map((c) => (
                <li key={c.iso} role="option" aria-selected={c.iso === country}>
                  <button
                    type="button"
                    className={`account-country-option${c.iso === country ? ' selected' : ''}`}
                    onClick={() => {
                      setCountry(c.iso);
                      setOpen(false);
                    }}
                  >
                    <span className="account-country-flag" aria-hidden="true">
                      {c.flag}
                    </span>
                    <span className="account-country-option-name">{c.name}</span>
                    <span dir="ltr">{c.code}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="account-country-empty" aria-hidden="true">
                  —
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
