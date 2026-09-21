import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = Exclude<ThemePreference, 'system'>;

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const STORAGE_KEY = 'theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getSystemTheme = (): ResolvedTheme =>
  window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

const getInitialPreference = (): ThemePreference => {
  const savedPreference = window.localStorage.getItem(STORAGE_KEY);
  return savedPreference === 'light' || savedPreference === 'dark' || savedPreference === 'system'
    ? savedPreference
    : 'system';
};

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [preference, setPreference] = useState<ThemePreference>(getInitialPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const updateTheme = () => {
      const nextTheme = preference === 'system'
        ? (mediaQuery.matches ? 'light' : 'dark')
        : preference;

      setResolvedTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    };

    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [preference]);

  const handlePreference = (nextPreference: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, nextPreference);
    setPreference(nextPreference);
  };

  // Cross-device sync: AuthProvider dispatches this event when the signed-in
  // user's persisted theme preference differs from local storage.
  useEffect(() => {
    const sync = (event: Event) => {
      const next = (event as CustomEvent<ThemePreference>).detail;
      if (next === 'light' || next === 'dark' || next === 'system') handlePreference(next);
    };
    window.addEventListener('cam-labs-theme-preference', sync);
    return () => window.removeEventListener('cam-labs-theme-preference', sync);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference: handlePreference }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
