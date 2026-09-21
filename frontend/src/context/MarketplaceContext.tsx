import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  CartConfiguration,
  CartItem,
  addCartItem,
  cartCount,
  clearGuestMarketplaceState,
  loadCartItems,
  loadFavorites,
  mergeCartItems,
  mergeFavoriteSets,
  removeCartItem,
  saveCartItems,
  saveFavorites,
  toggleFavoriteSet,
  updateCartQuantity,
} from '../utils/marketplaceStore';
import { getMarketplaceProduct, searchMarketplaceProducts } from '../data/marketplace';

export type MarketplaceSubView = 'listing' | 'product' | 'cart' | 'favorites';

interface MarketplaceContextValue {
  // Navigation within the marketplace context (sub-states of activeView='marketplace').
  subView: MarketplaceSubView;
  goToListing: () => void;
  openProduct: (productId: string) => void;
  openCart: () => void;
  openFavorites: () => void;
  selectedProductId: string | null;

  // Search over real product fields.
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;

  // Favorites (persistent, per customer, guest-capable).
  favorites: ReadonlySet<string>;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;

  // Cart (persistent, per customer, guest-capable). Cart items ≠ orders.
  cartItems: CartItem[];
  addToCart: (productId: string, config: CartConfiguration) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  itemCount: number;
  cartTotalEgp: number;
}

const MarketplaceContext = createContext<MarketplaceContextValue | undefined>(undefined);

export const MarketplaceProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const ownerId = currentUser?.id ?? 'guest';

  const [subView, setSubView] = useState<MarketplaceSubView>('listing');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(() => loadFavorites('guest'));
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadCartItems('guest'));
  const [hydratedOwner, setHydratedOwner] = useState<string>('guest');

  // Switch persistence scope when the account changes. Guest state merges
  // into the account once (union), then guest keys are cleared so a shared
  // device never leaks one shopper's cart into another session.
  useEffect(() => {
    if (ownerId === hydratedOwner) return;
    if (isAuthenticated) {
      const accountCart = loadCartItems(ownerId);
      const accountFavs = loadFavorites(ownerId);
      const guestCart = ownerId === 'guest' ? [] : loadCartItems('guest');
      const guestFavs = ownerId === 'guest' ? new Set<string>() : loadFavorites('guest');
      const mergedCart = mergeCartItems(accountCart, guestCart);
      const mergedFavs = mergeFavoriteSets(accountFavs, guestFavs);
      setCartItems(mergedCart);
      setFavorites(mergedFavs);
      saveCartItems(ownerId, mergedCart);
      saveFavorites(ownerId, mergedFavs);
      clearGuestMarketplaceState();
    } else {
      setCartItems(loadCartItems('guest'));
      setFavorites(loadFavorites('guest'));
    }
    setHydratedOwner(ownerId);
  }, [ownerId, isAuthenticated, hydratedOwner]);

  // Persist every change under the current owner scope.
  useEffect(() => {
    saveCartItems(hydratedOwner, cartItems);
  }, [hydratedOwner, cartItems]);
  useEffect(() => {
    saveFavorites(hydratedOwner, favorites);
  }, [hydratedOwner, favorites]);

  const goToListing = useCallback(() => {
    setSelectedProductId(null);
    setSubView('listing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openProduct = useCallback((productId: string) => {
    setSelectedProductId(productId);
    setSubView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openCart = useCallback(() => {
    setSubView('cart');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openFavorites = useCallback(() => {
    setSubView('favorites');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const clearSearch = useCallback(() => setSearchQuery(''), []);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) => toggleFavoriteSet(prev, productId));
  }, []);

  const isFavorite = useCallback((productId: string) => favorites.has(productId), [favorites]);

  const addToCart = useCallback((productId: string, config: CartConfiguration) => {
    setCartItems((prev) => addCartItem(prev, productId, config));
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setCartItems((prev) => updateCartQuantity(prev, lineId, quantity));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setCartItems((prev) => removeCartItem(prev, lineId));
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  const itemCount = useMemo(() => cartCount(cartItems), [cartItems]);

  const cartTotalEgp = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const product = getMarketplaceProduct(item.productId);
        return total + (product ? product.priceEgp * item.quantity : 0);
      }, 0),
    [cartItems],
  );

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      subView,
      goToListing,
      openProduct,
      openCart,
      openFavorites,
      selectedProductId,
      searchQuery,
      setSearchQuery,
      clearSearch,
      favorites,
      toggleFavorite,
      isFavorite,
      cartItems,
      addToCart,
      updateQuantity,
      removeLine,
      clearCart,
      itemCount,
      cartTotalEgp,
    }),
    [
      subView,
      goToListing,
      openProduct,
      openCart,
      openFavorites,
      selectedProductId,
      searchQuery,
      clearSearch,
      favorites,
      toggleFavorite,
      isFavorite,
      cartItems,
      addToCart,
      updateQuantity,
      removeLine,
      clearCart,
      itemCount,
      cartTotalEgp,
    ],
  );

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
};

export const useMarketplace = (): MarketplaceContextValue => {
  const context = useContext(MarketplaceContext);
  if (!context) throw new Error('useMarketplace must be used within a MarketplaceProvider');
  return context;
};

/** Filtered listing derived from the live search query (real fields only). */
export function useMarketplaceSearchResults() {
  const { searchQuery } = useMarketplace();
  return useMemo(() => searchMarketplaceProducts(searchQuery), [searchQuery]);
}
