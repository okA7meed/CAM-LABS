import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { ThemePreference, useTheme } from '../../context/ThemeContext';

type MenuId = 'theme' | 'language';

const SunIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
);
const MoonIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.4 14.8A8.5 8.5 0 0 1 9.2 3.6 8.5 8.5 0 1 0 20.4 14.8Z" /></svg>
);
const SystemIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
);
const TranslateIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h11M9 3v2M11.5 5c-.5 5-3.6 9-8 11M6 9c1.2 3 3.8 5.3 7 6.4" /><path d="M13 21l4.2-10 4.2 10M14.7 17.4h5" /></svg>
);
const CheckIcon = () => (
  <svg aria-hidden="true" className="nav-menu-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

export const HeaderPreferences: React.FC = () => {
  const { t } = useTranslation();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const languageButtonRef = useRef<HTMLButtonElement>(null);

  const locale = i18n.language.startsWith('ar') ? 'ar' : 'en';

  const closeMenu = useCallback((refocus?: MenuId) => {
    setOpenMenu(null);
    if (refocus === 'theme') themeButtonRef.current?.focus();
    if (refocus === 'language') languageButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!openMenu) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(openMenu);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu, closeMenu]);

  // Roving focus inside an open menu.
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.nav-menu-item'));
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown'
      ? (index + 1) % items.length
      : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const focusFirstItem = (menu: MenuId) => {
    window.requestAnimationFrame(() => {
      const selected = rootRef.current?.querySelector<HTMLButtonElement>(`#nav-menu-${menu} .nav-menu-item.selected`);
      (selected ?? rootRef.current?.querySelector<HTMLButtonElement>(`#nav-menu-${menu} .nav-menu-item`))?.focus();
    });
  };

  const toggleMenu = (menu: MenuId) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, menu: MenuId) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpenMenu(menu);
      focusFirstItem(menu);
    }
  };

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: t('theme.light'), icon: <SunIcon /> },
    { value: 'dark', label: t('theme.dark'), icon: <MoonIcon /> },
    { value: 'system', label: t('theme.system'), icon: <SystemIcon /> },
  ];

  const languageOptions: Array<{ value: 'en' | 'ar'; label: string; flag: string }> = [
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'ar', label: 'العربية', flag: '🇸🇦' },
  ];

  return (
    <div className="nav-preferences" ref={rootRef}>
      <div className="nav-menu-wrapper">
        <button
          type="button"
          ref={themeButtonRef}
          className={`nav-icon-button ${openMenu === 'theme' ? 'open' : ''}`}
          onClick={() => toggleMenu('theme')}
          onKeyDown={(event) => handleTriggerKeyDown(event, 'theme')}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'theme'}
          aria-controls="nav-menu-theme"
          aria-label={t('theme.color')}
          title={t('theme.color')}
        >
          {resolvedTheme === 'light' ? <SunIcon /> : <MoonIcon />}
        </button>
        {openMenu === 'theme' && (
          <div
            id="nav-menu-theme"
            className="nav-menu"
            role="menu"
            aria-label={t('theme.color')}
            onKeyDown={handleMenuKeyDown}
          >
            {themeOptions.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={preference === value}
                className={`nav-menu-item ${preference === value ? 'selected' : ''}`}
                onClick={() => {
                  setPreference(value);
                  closeMenu('theme');
                }}
              >
                <span className="nav-menu-icon">{icon}</span>
                <span className="nav-menu-label">{label}</span>
                {preference === value && <CheckIcon />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="nav-menu-wrapper">
        <button
          type="button"
          ref={languageButtonRef}
          className={`nav-icon-button ${openMenu === 'language' ? 'open' : ''}`}
          onClick={() => toggleMenu('language')}
          onKeyDown={(event) => handleTriggerKeyDown(event, 'language')}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'language'}
          aria-controls="nav-menu-language"
          aria-label={t('nav.language')}
          title={t('nav.language')}
        >
          <TranslateIcon />
        </button>
        {openMenu === 'language' && (
          <div
            id="nav-menu-language"
            className="nav-menu"
            role="menu"
            aria-label={t('nav.language')}
            onKeyDown={handleMenuKeyDown}
          >
            {languageOptions.map(({ value, label, flag }) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={locale === value}
                className={`nav-menu-item ${locale === value ? 'selected' : ''}`}
                onClick={() => {
                  void i18n.changeLanguage(value);
                  closeMenu('language');
                }}
              >
                <span className="nav-menu-icon nav-menu-flag" aria-hidden="true">{flag}</span>
                <span className="nav-menu-label">{label}</span>
                {locale === value && <CheckIcon />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
