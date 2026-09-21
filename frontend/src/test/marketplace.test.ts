import { describe, expect, it } from 'vitest';
import {
  addCartItem,
  buildLineId,
  cartCount,
  clampQuantity,
  mergeCartItems,
  mergeFavoriteSets,
  removeCartItem,
  toggleFavoriteSet,
  updateCartQuantity,
} from '../utils/marketplaceStore';
import { getMarketplaceProduct, MARKETPLACE_PRODUCTS, searchMarketplaceProducts } from '../data/marketplace';

describe('marketplace catalog integrity', () => {
  it('keeps the four real products with real prices', () => {
    expect(MARKETPLACE_PRODUCTS).toHaveLength(4);
    expect(MARKETPLACE_PRODUCTS.map((p) => p.id)).toEqual([
      'phone-stand',
      'sensor-enclosure',
      'mounting-bracket',
      'desk-fixture',
    ]);
  });

  it('resolves every product by id', () => {
    for (const product of MARKETPLACE_PRODUCTS) {
      expect(getMarketplaceProduct(product.id)?.price).toBe(product.price);
    }
  });

  it('searches real fields (name, material, process, category)', () => {
    expect(searchMarketplaceProducts('').length).toBe(4);
    expect(searchMarketplaceProducts('aluminum').map((p) => p.id)).toEqual(['mounting-bracket']);
    expect(searchMarketplaceProducts('NILE robotics').map((p) => p.id)).toEqual(['sensor-enclosure']);
    expect(searchMarketplaceProducts('cnc').map((p) => p.id)).toEqual(['mounting-bracket']);
    expect(searchMarketplaceProducts('no-such-part-xyz')).toEqual([]);
    // Multi-token: every token must match somewhere.
    expect(searchMarketplaceProducts('aluminum workshop').map((p) => p.id)).toEqual(['mounting-bracket']);
    expect(searchMarketplaceProducts('aluminum automation')).toEqual([]);
  });
});

describe('cart helpers (cart items are never orders)', () => {
  it('adds a line with a stable id and clamps quantity', () => {
    const items = addCartItem([], 'mounting-bracket', {
      material: 'Aluminum 6061',
      color: 'Graphite',
      quantity: 2,
    });
    expect(items).toHaveLength(1);
    expect(items[0].lineId).toBe(buildLineId('mounting-bracket', { material: 'Aluminum 6061', color: 'Graphite' }));
    expect(items[0].quantity).toBe(2);
    expect(items[0]).not.toHaveProperty('orderId');
  });

  it('merges identical configurations instead of duplicating lines', () => {
    let items = addCartItem([], 'mounting-bracket', { material: 'Aluminum 6061', color: 'Graphite', quantity: 1 });
    items = addCartItem(items, 'mounting-bracket', { material: 'Aluminum 6061', color: 'Graphite', quantity: 3 });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(4);
  });

  it('keeps distinct configurations as separate lines', () => {
    let items = addCartItem([], 'mounting-bracket', { material: 'Aluminum 6061', color: 'Graphite', quantity: 1 });
    items = addCartItem(items, 'mounting-bracket', { material: 'Aluminum 6061', color: 'Stone', quantity: 1 });
    expect(items).toHaveLength(2);
  });

  it('clamps quantity updates to 1..99', () => {
    const items = addCartItem([], 'mounting-bracket', { material: 'Aluminum 6061', color: 'Graphite', quantity: 1 });
    const lineId = items[0].lineId;
    expect(updateCartQuantity(items, lineId, 0)[0].quantity).toBe(1);
    expect(updateCartQuantity(items, lineId, 500)[0].quantity).toBe(99);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });

  it('removes lines and counts total units', () => {
    let items = addCartItem([], 'mounting-bracket', { material: 'Aluminum 6061', color: 'Graphite', quantity: 2 });
    items = addCartItem(items, 'desk-fixture', { material: 'PETG', color: 'Stone', quantity: 3 });
    expect(cartCount(items)).toBe(5);
    items = removeCartItem(items, items[0].lineId);
    expect(items).toHaveLength(1);
    expect(cartCount(items)).toBe(3);
  });

  it('merges guest cart into the account on sign-in', () => {
    const account = addCartItem([], 'mounting-bracket', { material: 'Aluminum 6061', color: 'Graphite', quantity: 1 });
    const guest = addCartItem([], 'desk-fixture', { material: 'PETG', color: 'Stone', quantity: 2 });
    const merged = mergeCartItems(account, guest);
    expect(merged).toHaveLength(2);
    expect(cartCount(merged)).toBe(3);
  });
});

describe('favorites helpers', () => {
  it('toggles membership without duplicates', () => {
    let favs = toggleFavoriteSet(new Set(), 'mounting-bracket');
    expect(favs.has('mounting-bracket')).toBe(true);
    favs = toggleFavoriteSet(favs, 'mounting-bracket');
    expect(favs.has('mounting-bracket')).toBe(false);
  });

  it('merges guest favorites into the account (union)', () => {
    const merged = mergeFavoriteSets(new Set(['a']), new Set(['b', 'a']));
    expect([...merged].sort()).toEqual(['a', 'b']);
  });
});
