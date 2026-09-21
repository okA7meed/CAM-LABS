import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { StoreProvider, useStore } from './StoreContext';
import { en } from '../i18n/en';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      let value = (en as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) value = value.replace(`{{${k}}}`, v);
      }
      return value;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
      public code?: string,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
  ApiService: {
    getOrders: vi.fn(async () => null),
    getQuotes: vi.fn(async () => null),
    getCadFiles: vi.fn(async () => null),
    getCurrentUser: vi.fn(async () => null),
  },
}));

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, currentUser: null }),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  window.localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

/**
 * Regression test for the Quotes Management toast storm: list views load data
 * inside `useEffect(..., [load])` where `load` depends on `showToast`. If
 * `showToast` is not referentially stable, every render (including the toast
 * state update from a failure) retriggers the fetch — one failure becomes an
 * unbounded request loop with a toast per iteration.
 */
describe('StoreContext toast stability', () => {
  it('keeps showToast referentially stable across rerenders', () => {
    const seen: unknown[] = [];
    let bump: ((v: (n: number) => number) => void) | null = null;

    const Probe: React.FC = () => {
      const { showToast } = useStore();
      const [, setTick] = React.useState(0);
      useEffect(() => {
        seen.push(showToast);
      }, [showToast]);
      useEffect(() => {
        bump = setTick;
      }, []);
      return null;
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <StoreProvider>
          <Probe />
        </StoreProvider>,
      );
    });

    act(() => {
      bump?.((n) => n + 1);
    });
    act(() => {
      bump?.((n) => n + 1);
    });

    // showToast identity must survive rerenders so data loaders do not loop.
    expect(seen.length).toBeGreaterThan(0);
    for (const fn of seen) expect(fn).toBe(seen[0]);
  });
});

describe('StoreContext toast design system', () => {
  const mountProbe = () => {
    const api: {
      showToast?: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning', options?: Record<string, unknown>) => void;
      toasts?: Array<{ id: string; title: string; message: string; type: string; icon: string; durationMs: number; repeat: number; action?: { label: string } | null }>;
    } = {};
    const Probe: React.FC = () => {
      const store = useStore();
      useEffect(() => {
        api.showToast = store.showToast as typeof api.showToast;
        api.toasts = store.toasts as typeof api.toasts;
      });
      return null;
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <StoreProvider>
          <Probe />
        </StoreProvider>,
      );
    });
    return api;
  };

  it('assigns severity durations and default icons', () => {
    const api = mountProbe();
    act(() => {
      api.showToast?.('Saved', 'All good', 'success');
      api.showToast?.('Broken', 'Nope', 'error');
      api.showToast?.('Note', 'Heads up', 'warning');
      api.showToast?.('FYI', 'Just so you know', 'info');
    });
    expect(api.toasts).toHaveLength(4);
    const byTitle = Object.fromEntries(api.toasts!.map((t) => [t.title, t]));
    expect(byTitle['Saved'].durationMs).toBe(4500);
    expect(byTitle['Saved'].icon).toBe('check');
    expect(byTitle['Broken'].durationMs).toBe(8000);
    expect(byTitle['Broken'].icon).toBe('alert');
    expect(byTitle['Note'].durationMs).toBe(6000);
    expect(byTitle['FYI'].durationMs).toBe(4500);
    expect(byTitle['FYI'].icon).toBe('info');
  });

  it('coalesces identical visible toasts instead of stacking', () => {
    const api = mountProbe();
    act(() => {
      api.showToast?.('Failed to load data', 'Network glitch', 'error');
      api.showToast?.('Failed to load data', 'Network glitch', 'error');
      api.showToast?.('Failed to load data', 'Network glitch', 'error');
    });
    expect(api.toasts).toHaveLength(1);
    expect(api.toasts![0].repeat).toBe(2);
    act(() => {
      api.showToast?.('Failed to load data', 'Different detail', 'error');
    });
    expect(api.toasts).toHaveLength(2);
  });

  it('supports domain icon and action options', () => {
    const api = mountProbe();
    const onClick = vi.fn();
    act(() => {
      api.showToast?.('Quote submitted', 'CAM-2026-1', 'success', { icon: 'file', action: { label: 'View', onClick } });
    });
    expect(api.toasts).toHaveLength(1);
    expect(api.toasts![0].icon).toBe('file');
    expect(api.toasts![0].action?.label).toBe('View');
  });

  it('auto-dismisses after its real duration', () => {
    vi.useFakeTimers();
    try {
      const api = mountProbe();
      act(() => {
        api.showToast?.('Saved', 'All good', 'success');
      });
      expect(api.toasts).toHaveLength(1);
      act(() => {
        vi.advanceTimersByTime(4499);
      });
      expect(api.toasts).toHaveLength(1);
      act(() => {
        vi.advanceTimersByTime(2);
      });
      expect(api.toasts).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
