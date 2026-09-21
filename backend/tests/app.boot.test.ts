import { describe, expect, it } from 'vitest';

/**
 * Boot smoke test: importing and constructing the Express app must never
 * throw. This catches wiring regressions (e.g. a router used without import
 * raising ReferenceError at startup, which previously took down every
 * customer and admin fetch at once).
 */
describe('Application boot wiring', () => {
  it('createApp() constructs without throwing', async () => {
    const { createApp } = await import('../src/app');
    let app: unknown = null;
    expect(() => {
      app = createApp();
    }).not.toThrow();
    expect(app).toBeTruthy();
  });

  it('all routers are mounted (no missing import silently dropping a surface)', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    const stack: any[] = ((app as any)._router?.stack || []).filter((l: any) => l.route || l.name === 'router');
    const mounted = stack
      .map((l: any) => l.regexp?.toString() || '')
      .join('\n');
    for (const prefix of [
      'health',
      'auth',
      'materials',
      'orders',
      'quotes',
      'cad-files',
      'technical-documents',
      'manufacturing',
      'pricing',
      'coupons',
      'shipping',
      'admin',
      'reports',
      'settings',
    ]) {
      expect(mounted).toContain(prefix);
    }
  });
});
