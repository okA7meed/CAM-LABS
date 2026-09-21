/**
 * Marketplace cart + favorites — pure, testable helpers plus a tiny
 * localStorage persistence layer.
 *
 * There is deliberately NO backend involvement: the backend has no cart,
 * favorites, product or checkout models (verified in
 * backend/src/database/prisma/schema.prisma), and the task forbids inventing
 * APIs or destructive schema work. State persists per customer (user id) with
 * a guest fallback, and merges guest state into the account on sign-in.
 *
 * CRITICAL INVARIANT: cart items are never orders. They carry a product
 * reference + configuration snapshot only. Order creation stays exclusively
 * in the quote → admin-approval → order lifecycle.
 */

export interface CartConfiguration {
  material: string;
  color: string;
  customText?: string;
  quantity: number;
}

export interface CartItem {
  /** Stable line id: `${productId}::${material}::${color}::${customText}` */
  lineId: string;
  productId: string;
  quantity: number;
  material: string;
  color: string;
  customText?: string;
  addedAt: string;
}

export const MAX_CART_QTY = 99;
export const MIN_CART_QTY = 1;

export const clampQuantity = (qty: number): number => {
  if (!Number.isFinite(qty)) return MIN_CART_QTY;
  return Math.min(MAX_CART_QTY, Math.max(MIN_CART_QTY, Math.floor(qty)));
};

export function buildLineId(productId: string, config: Pick<CartConfiguration, 'material' | 'color' | 'customText'>): string {
  return [productId, config.material, config.color, (config.customText ?? '').trim()].join('::');
}

/** Add (or merge) a line. Never touches orders, quotes or payments. */
export function addCartItem(items: CartItem[], productId: string, config: CartConfiguration): CartItem[] {
  const quantity = clampQuantity(config.quantity);
  const lineId = buildLineId(productId, config);
  const existing = items.find((item) => item.lineId === lineId);
  if (existing) {
    return items.map((item) =>
      item.lineId === lineId ? { ...item, quantity: clampQuantity(item.quantity + quantity) } : item,
    );
  }
  return [
    ...items,
    {
      lineId,
      productId,
      quantity,
      material: config.material,
      color: config.color,
      customText: (config.customText ?? '').trim() || undefined,
      addedAt: new Date().toISOString(),
    },
  ];
}

export function updateCartQuantity(items: CartItem[], lineId: string, quantity: number): CartItem[] {
  return items.map((item) =>
    item.lineId === lineId ? { ...item, quantity: clampQuantity(quantity) } : item,
  );
}

export function removeCartItem(items: CartItem[], lineId: string): CartItem[] {
  return items.filter((item) => item.lineId !== lineId);
}

export const cartCount = (items: CartItem[]): number =>
  items.reduce((total, item) => total + item.quantity, 0);

export function toggleFavoriteSet(favorites: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(favorites);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Merge guest state into account state on sign-in (union, guest wins ties). */
export function mergeCartItems(account: CartItem[], guest: CartItem[]): CartItem[] {
  let merged = [...account];
  for (const guestItem of guest) {
    merged = addCartItem(merged, guestItem.productId, {
      material: guestItem.material,
      color: guestItem.color,
      customText: guestItem.customText,
      quantity: guestItem.quantity,
    });
  }
  return merged;
}

export function mergeFavoriteSets(account: ReadonlySet<string>, guest: ReadonlySet<string>): Set<string> {
  return new Set([...account, ...guest]);
}

// ── Persistence ─────────────────────────────────────────────────────────────

const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable (private mode) — state stays in memory */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const cartStorageKey = (ownerId: string): string => `cam-labs-cart:${ownerId}`;
export const favoritesStorageKey = (ownerId: string): string => `cam-labs-favorites:${ownerId}`;

export function loadCartItems(ownerId: string): CartItem[] {
  const raw = safeStorage.get(cartStorageKey(ownerId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        typeof item?.lineId === 'string' &&
        typeof item?.productId === 'string' &&
        Number.isFinite(item?.quantity),
    );
  } catch {
    return [];
  }
}

export function saveCartItems(ownerId: string, items: CartItem[]): void {
  safeStorage.set(cartStorageKey(ownerId), JSON.stringify(items));
}

export function loadFavorites(ownerId: string): Set<string> {
  const raw = safeStorage.get(favoritesStorageKey(ownerId));
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites(ownerId: string, favorites: ReadonlySet<string>): void {
  safeStorage.set(favoritesStorageKey(ownerId), JSON.stringify([...favorites]));
}

export function clearGuestMarketplaceState(): void {
  safeStorage.remove(cartStorageKey('guest'));
  safeStorage.remove(favoritesStorageKey('guest'));
}
