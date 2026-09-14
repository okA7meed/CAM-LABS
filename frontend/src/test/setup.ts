import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = Object.assign(
      (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        onchange: null,
        dispatchEvent: () => false,
      }),
      { prototype: {} },
    );
  }
  if (typeof window.ResizeObserver === 'undefined') {
    class ResizeObserver { observe() {} unobserve() {} disconnect() {} }
    (window as unknown as Record<string, unknown>).ResizeObserver = ResizeObserver;
  }
}