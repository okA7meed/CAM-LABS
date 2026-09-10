import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemePreference, useTheme } from '../../context/ThemeContext';

const SunIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
);
const MoonIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.4 14.8A8.5 8.5 0 0 1 9.2 3.6 8.5 8.5 0 1 0 20.4 14.8Z" /></svg>
);
const SystemIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
);
const CheckIcon = () => (
  <svg aria-hidden="true" className="nav-menu-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

interface ThemeMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ThemeMenu: React.FC<ThemeMenuProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const changeOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) changeOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        changeOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  const focusFirstItem = () => {
    window.requestAnimationFrame(() => {
      const selected = rootRef.current?.querySelector<HTMLButtonElement>('#nav-menu-theme .nav-menu-item.selected');
      (selected ?? rootRef.current?.querySelector<HTMLButtonElement>('#nav-menu-theme .nav-menu-item'))?.focus();
    });
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    changeOpen(true);
    focusFirstItem();
  };

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: t('theme.light'), icon: <SunIcon /> },
    { value: 'dark', label: t('theme.dark'), icon: <MoonIcon /> },
    { value: 'system', label: t('theme.system'), icon: <SystemIcon /> },
  ];

  const selectTheme = (value: ThemePreference) => {
    setPreference(value);
    changeOpen(false);
  };

  return (
    <div className="nav-menu-wrapper" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className={`nav-icon-button ${isOpen ? 'open' : ''}`}
        onClick={() => changeOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="nav-menu-theme"
        aria-label={t('theme.color')}
        title={t('theme.color')}
      >
        {resolvedTheme === 'light' ? <SunIcon /> : <MoonIcon />}
      </button>
      {isOpen && (
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
              onClick={() => selectTheme(value)}
            >
              <span className="nav-menu-icon">{icon}</span>
              <span className="nav-menu-label">{label}</span>
              {preference === value && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};