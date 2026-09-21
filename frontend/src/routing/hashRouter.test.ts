import { describe, expect, it } from 'vitest';
import { parseHash, viewToHash } from './hashRouter';

describe('hash router', () => {
  it('maps views to stable hashes', () => {
    expect(viewToHash('home')).toBe('#/');
    expect(viewToHash('dashboard')).toBe('#/dashboard');
    expect(viewToHash('orders')).toBe('#/orders');
    expect(viewToHash('profile')).toBe('#/account');
    expect(viewToHash('profile', 'addresses')).toBe('#/account/addresses');
    expect(viewToHash('profile', 'personal')).toBe('#/account');
    expect(viewToHash('admin-order-detail')).toBe('#/admin/orders');
    expect(viewToHash('quotes')).toBe('#/quotes');
  });

  it('parses hashes back to views', () => {
    expect(parseHash('#/')).toEqual({ view: 'home', accountSection: 'personal' });
    expect(parseHash('')).toEqual({ view: 'home', accountSection: 'personal' });
    expect(parseHash('#/dashboard')).toEqual({ view: 'dashboard', accountSection: 'personal' });
    expect(parseHash('#/orders')).toEqual({ view: 'orders', accountSection: 'personal' });
    expect(parseHash('#/account')).toEqual({ view: 'profile', accountSection: 'personal' });
    expect(parseHash('#/account/security')).toEqual({ view: 'profile', accountSection: 'security' });
    expect(parseHash('#/quotes')).toEqual({ view: 'quotes', accountSection: 'personal' });
    expect(parseHash('#/admin/orders')).toEqual({ view: 'admin-orders', accountSection: 'personal' });
  });

  it('rejects unknown hashes without clobbering state', () => {
    expect(parseHash('#/nope')).toBeNull();
    expect(parseHash('#/account/manufacturing')).toBeNull();
    expect(parseHash('#/account/preferences')).toBeNull();
  });

  it('tolerates hashes without the leading slash', () => {
    expect(parseHash('#dashboard')).toEqual({ view: 'dashboard', accountSection: 'personal' });
    expect(parseHash('#orders')).toEqual({ view: 'orders', accountSection: 'personal' });
    expect(parseHash('#account')).toEqual({ view: 'profile', accountSection: 'personal' });
    expect(parseHash('#account/security')).toEqual({ view: 'profile', accountSection: 'security' });
  });

  it('round-trips every mapped view', () => {
    const views = ['dashboard', 'orders', 'profile', 'quotes', 'contact', 'marketplace', 'admin-quotes'] as const;
    for (const view of views) {
      const parsed = parseHash(viewToHash(view));
      expect(parsed?.view).toBe(view === 'profile' ? 'profile' : view);
    }
    expect(parseHash(viewToHash('profile', 'notifications'))).toEqual({
      view: 'profile',
      accountSection: 'notifications',
    });
  });
});
