import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { Order, Quote, CadFile, ToastMessage, ToastOptions, ToastType, ViewType } from '../types';
import type { IconName } from '../components/ui/Icon';
import { ApiService } from '../services/api';
import { useAuth } from './AuthContext';
import { AccountSection, isAccountSection, parseHash, writeHash } from '../routing/hashRouter';

export interface SetViewOptions {
  /** Account sub-section (only meaningful for the `profile` view). */
  section?: AccountSection;
  /** Replace the history entry instead of pushing (boot, redirects). */
  replace?: boolean;
}

interface StoreContextType {
  orders: Order[];
  quotes: Quote[];
  cadFiles: CadFile[];
  isCustomerDataLoading: boolean;
  refreshCustomerData: () => Promise<void>;
  comparisonList: string[];
  toasts: ToastMessage[];
  activeView: ViewType;
  setActiveView: (view: ViewType, options?: SetViewOptions) => void;
  /** Account Settings sub-section (single source; synced with `#/account/*`). */
  accountSection: AccountSection;
  /** Deep-open a customer order detail inside the orders view. */
  pendingOrderDetailId: string | null;
  requestOrderDetail: (orderId: string) => void;
  consumeOrderDetail: () => void;

  // Footer-driven materials explorer preset (tech/category/search + nonce).
  // Consumed once by MaterialsExplorer; never a URL param.
  materialsPreset: { tech?: string; category?: string; search?: string; nonce: number } | null;
  requestMaterialsPreset: (preset: { tech?: string; category?: string; search?: string }) => void;
  consumeMaterialsPreset: () => void;

  // Post-auth resume destination for auth-gated footer navigation.
  // Set before opening the auth modal; AuthModal navigates here on success.
  postAuthDestination: ViewType | null;
  setPostAuthDestination: (view: ViewType | null) => void;

  // Modals state
  startManufacturingRequest: () => void;
  leavingToWorkspace: boolean;
  openComingSoon: () => void;

  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;

  isPersonaModalOpen: boolean;
  openPersonaModal: () => void;
  closePersonaModal: () => void;

  isForgotPasswordOpen: boolean;
  openForgotPassword: () => void;
  closeForgotPassword: () => void;

  isComparisonModalOpen: boolean;
  openComparisonModal: () => void;
  closeComparisonModal: () => void;

  selectedOrder: Order | null;
  isOrderTimelineOpen: boolean;
  openOrderTimeline: (order: Order) => void;
  closeOrderTimeline: () => void;

  selectedOrderIds: string[];
  toggleOrderSelection: (id: string) => void;
  clearOrderSelection: () => void;

  selectedAdminOrderId: string | null;
  selectedAdminCustomerId: string | null;
  selectedAdminManufacturerId: string | null;
  selectedAdminManufacturingRequestId: string | null;
  selectedAdminQuoteId: string | null;
  selectedAdminCadFileId: string | null;
  selectedAdminCouponId: string | null;
  openAdminOrderDetail: (id: string) => void;
  openAdminCustomerDetail: (id: string) => void;
  openAdminManufacturerDetail: (id: string) => void;
  openAdminManufacturingRequestDetail: (id: string) => void;
  openAdminQuoteDetail: (id: string) => void;
  openAdminDeletionRequests: () => void;
  openAdminCadFileDetail: (id: string) => void;
  openAdminCouponDetail: (id: string) => void;
  closeAdminDetail: () => void;
  submittedQuote: (Quote & Record<string, any>) | null;
  setSubmittedQuote: (q: ((Quote & Record<string, any>) | null)) => void;

  // Actions
  addCadFile: (fileData: Partial<CadFile>) => CadFile;
  toggleComparison: (materialId: string) => void;
  clearComparison: () => void;
  showToast: (title: string, message: string, type?: ToastType, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, currentUser } = useAuth();
  // Boot from the URL hash so refresh and direct links restore the view.
  const [activeView, setActiveViewState] = useState<ViewType>(() => parseHash()?.view || 'home');
  const [accountSection, setAccountSectionState] = useState<AccountSection>(() => parseHash()?.accountSection || 'personal');
  const [pendingOrderDetailId, setPendingOrderDetailId] = useState<string | null>(null);

  // Footer-driven navigation helpers (additive; existing flows untouched).
  const [materialsPreset, setMaterialsPreset] = useState<{
    tech?: string; category?: string; search?: string; nonce: number;
  } | null>(null);
  const requestMaterialsPreset = useCallback((preset: { tech?: string; category?: string; search?: string }) => {
    setMaterialsPreset({ ...preset, nonce: Date.now() });
  }, []);
  const consumeMaterialsPreset = useCallback(() => setMaterialsPreset(null), []);
  const [postAuthDestination, setPostAuthDestination] = useState<ViewType | null>(null);

  // Customer orders / quotes / CAD files are sourced from the database via the
  // API. They are NEVER seeded with demo data — empty until the user authenticates,
  // at which point the real records are fetched.
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [cadFiles, setCadFiles] = useState<CadFile[]>([]);
  const [isCustomerDataLoading, setIsCustomerDataLoading] = useState(false);

  const refreshCustomerData = useCallback(async () => {
    setIsCustomerDataLoading(true);
    try {
      const [freshOrders, freshQuotes, freshFiles] = await Promise.all([
        ApiService.getOrders().catch(() => null),
        ApiService.getQuotes().catch(() => null),
        ApiService.getCadFiles().catch(() => null),
      ]);
      if (freshOrders) setOrders(freshOrders);
      // Domain rule: converted Quotes have left the customer's active Quotes
      // for Orders (`convertedOrderId IS NULL`). The API already scopes to
      // active rows; this guards stale caches too. Approved-but-unconverted
      // rows (if any) remain visible — only conversion moves a Quote out.
      if (freshQuotes) setQuotes(freshQuotes.filter((quote) => !quote.convertedOrderId));
      if (freshFiles) setCadFiles(freshFiles);
    } finally {
      setIsCustomerDataLoading(false);
    }
  }, []);

  const clearCustomerData = useCallback(() => {
    setOrders([]);
    setQuotes([]);
    setCadFiles([]);
  }, []);

  // Load the real customer records when authenticated, and clear them on sign-out.
  useEffect(() => {
    if (isAuthenticated) {
      void refreshCustomerData();
    } else {
      clearCustomerData();
    }
  }, [isAuthenticated, currentUser?.id, refreshCustomerData, clearCustomerData]);

  const [comparisonList, setComparisonList] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [leavingToWorkspace, setLeavingToWorkspace] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderTimelineOpen, setIsOrderTimelineOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((oid) => oid !== id) : [...prev, id],
    );
  };

  const clearOrderSelection = () => setSelectedOrderIds([]);

  const [selectedAdminOrderId, setSelectedAdminOrderId] = useState<string | null>(null);
  const [selectedAdminCustomerId, setSelectedAdminCustomerId] = useState<string | null>(null);
  const [selectedAdminManufacturerId, setSelectedAdminManufacturerId] = useState<string | null>(null);
  const [selectedAdminManufacturingRequestId, setSelectedAdminManufacturingRequestId] = useState<string | null>(null);
  const [selectedAdminQuoteId, setSelectedAdminQuoteId] = useState<string | null>(null);
  const [selectedAdminCadFileId, setSelectedAdminCadFileId] = useState<string | null>(null);
  const [selectedAdminCouponId, setSelectedAdminCouponId] = useState<string | null>(null);
  const [submittedQuote, setSubmittedQuote] = useState<(Quote & Record<string, any>) | null>(null);

  // One-time cleanup: purge any legacy demo/localStorage order state written by
  // the previous dashboard implementation, so it can never resurface.
  useEffect(() => {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('CAM_LABS_STORE_DATA'))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      /* ignore storage errors */
    }
  }, []);

  // Toast handler — memoized so list-view data loaders that depend on it
  // (useCallback + useEffect) keep a stable identity and do not refetch in
  // a loop. It only uses refs plus the stable setToasts updater.
  //
  // Duplicate suppression: an identical visible toast (same type + title +
  // message) never stacks — the existing instance is refreshed instead
  // (timer + progress restart, no re-announcement storm). Distinct errors
  // always produce their own toast; at most MAX_TOASTS are kept.
  const toastTimers = useRef(new Map<string, number>());
  const toastKeyById = useRef(new Map<string, string>());
  const toastIdByKey = useRef(new Map<string, string>());

  const clearToastTimer = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    clearToastTimer(id);
    const key = toastKeyById.current.get(id);
    if (key !== undefined) {
      toastKeyById.current.delete(id);
      if (toastIdByKey.current.get(key) === id) toastIdByKey.current.delete(key);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [clearToastTimer]);

  // Timer hygiene for unmount (test harnesses, rare provider remounts).
  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const MAX_TOASTS = 6;
  const DEFAULT_TOAST_DURATIONS: Record<ToastType, number> = {
    success: 4500,
    info: 4500,
    warning: 6000,
    error: 8000,
  };
  const DEFAULT_TOAST_ICONS: Record<ToastType, IconName> = {
    success: 'check',
    error: 'alert',
    warning: 'alert',
    info: 'info',
  };

  const showToast = useCallback((
    title: string,
    message: string,
    type: ToastType = 'info',
    options?: ToastOptions,
  ) => {
    const durationMs = options?.durationMs ?? DEFAULT_TOAST_DURATIONS[type];
    const key = `${type}|${title}|${message}`;
    const now = Date.now();
    const existingId = toastIdByKey.current.get(key);
    if (existingId !== undefined) {
      clearToastTimer(existingId);
      const id = existingId;
      toastTimers.current.set(id, window.setTimeout(() => removeToast(id), durationMs));
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, durationMs, expiresAt: now + durationMs, repeat: t.repeat + 1 } : t))
      );
      return;
    }
    const id = `toast-${now}-${Math.random().toString(36).slice(2)}`;
    const newToast: ToastMessage = {
      id,
      title,
      message,
      type,
      icon: options?.icon ?? DEFAULT_TOAST_ICONS[type],
      action: options?.action,
      durationMs,
      expiresAt: now + durationMs,
      repeat: 0,
    };
    toastKeyById.current.set(id, key);
    toastIdByKey.current.set(key, id);
    toastTimers.current.set(id, window.setTimeout(() => removeToast(id), durationMs));
    setToasts((prev) => [...prev, newToast].slice(-MAX_TOASTS));
  }, [removeToast, clearToastTimer]);

  // ── Hash-routed navigation ──────────────────────────────────────────
  // Every view change writes a stable `#/...` hash (push → Back/Forward
  // works); hash changes from Back/Forward/direct links map back to state.
  const sectionRef = useRef<AccountSection>(accountSection);
  sectionRef.current = accountSection;

  const setActiveView = useCallback((view: ViewType, options?: SetViewOptions) => {
    if (options?.section && isAccountSection(options.section)) {
      setAccountSectionState(options.section);
      sectionRef.current = options.section;
    }
    setActiveViewState(view);
    writeHash(view, view === 'profile' ? options?.section || sectionRef.current : undefined, options?.replace);
    window.scrollTo({ top: 0 });
  }, []);

  // Back/Forward buttons, direct links, and refresh restore.
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash();
      if (!parsed) return;
      setActiveViewState(parsed.view);
      if (parsed.view === 'profile') {
        setAccountSectionState(parsed.accountSection);
        sectionRef.current = parsed.accountSection;
      }
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const requestOrderDetail = useCallback((orderId: string) => {
    setPendingOrderDetailId(orderId);
    setActiveViewState('orders');
    writeHash('orders');
    window.scrollTo({ top: 0 });
  }, []);

  const consumeOrderDetail = useCallback(() => setPendingOrderDetailId(null), []);

  // Modals controls
  const startManufacturingRequest = () => {
    if (activeView === 'manufacturing-request' || leavingToWorkspace) return;
    const fromLanding = activeView === 'home' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fromLanding) {
      setActiveView('manufacturing-request');
      return;
    }
    setLeavingToWorkspace(true);
    window.setTimeout(() => { setActiveView('manufacturing-request'); setLeavingToWorkspace(false); }, 580);
  };

  const openComingSoon = () => {
    setActiveView('coming-soon');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => setIsAuthModalOpen(false);

  const openPersonaModal = () => setIsPersonaModalOpen(true);
  const closePersonaModal = () => setIsPersonaModalOpen(false);

  const openForgotPassword = () => {
    setIsAuthModalOpen(false);
    setIsForgotPasswordOpen(true);
  };
  const closeForgotPassword = () => setIsForgotPasswordOpen(false);

  const openComparisonModal = () => setIsComparisonModalOpen(true);
  const closeComparisonModal = () => setIsComparisonModalOpen(false);

  const openOrderTimeline = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderTimelineOpen(true);
  };
  const closeOrderTimeline = () => {
    setIsOrderTimelineOpen(false);
    setSelectedOrder(null);
  };

  const closeAdminDetail = () => {
    setSelectedAdminOrderId(null);
    setSelectedAdminCustomerId(null);
    setSelectedAdminManufacturerId(null);
    setSelectedAdminManufacturingRequestId(null);
    setSelectedAdminQuoteId(null);
    setSelectedAdminCadFileId(null);
    setSelectedAdminCouponId(null);
  };

  const openAdminOrderDetail = (id: string) => {
    closeAdminDetail();
    setSelectedAdminOrderId(id);
    setActiveView('admin-order-detail');
  };

  const openAdminCustomerDetail = (id: string) => {
    closeAdminDetail();
    setSelectedAdminCustomerId(id);
    setActiveView('admin-customer-detail');
  };

  const openAdminManufacturerDetail = (id: string) => {
    closeAdminDetail();
    setSelectedAdminManufacturerId(id);
    setActiveView('admin-manufacturer-detail');
  };

  const openAdminManufacturingRequestDetail = (id: string) => {
    closeAdminDetail();
    setSelectedAdminManufacturingRequestId(id);
    setActiveView('admin-manufacturing-request-detail');
  };

  const openAdminQuoteDetail = (id: string) => {
    closeAdminDetail();
    setSelectedAdminQuoteId(id);
    setActiveView('admin-quote-detail');
  };

  const openAdminDeletionRequests = () => {
    closeAdminDetail();
    setActiveView('admin-deletion-requests');
  };

  const openAdminCadFileDetail = (id: string) => {
    closeAdminDetail();
    setSelectedAdminCadFileId(id);
    setActiveView('admin-cad-file-detail');
  };

  const openAdminCouponDetail = (id: string) => {
    closeAdminDetail();
    setSelectedAdminCouponId(id);
    setActiveView('admin-discount-code-detail');
  };

  // Data Actions
  const addCadFile = (fileData: Partial<CadFile>): CadFile => {
    const newFile: CadFile = {
      id: `file-${Date.now()}`,
      name: fileData.name || 'Component.step',
      format: fileData.format || 'STEP',
      size: fileData.size || '12.4 MB',
      uploaded: new Date().toISOString().split('T')[0],
      volume: fileData.volume || '65.4 cm³',
      dimensions: fileData.dimensions || '100 × 50 × 30 mm',
      meshTriangles: fileData.meshTriangles || '124,000',
      status: 'Verified CAD',
      ...fileData,
    };

    setCadFiles((prev) => [newFile, ...prev]);
    return newFile;
  };

  const toggleComparison = (materialId: string) => {
    setComparisonList((prev) => {
      if (prev.includes(materialId)) {
        return prev.filter((id) => id !== materialId);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), materialId];
      }
      return [...prev, materialId];
    });
  };

  const clearComparison = () => setComparisonList([]);

  return (
    <StoreContext.Provider
      value={{
        orders,
        quotes,
        cadFiles,
        isCustomerDataLoading,
        refreshCustomerData,
        comparisonList,
        toasts,
        activeView,
        setActiveView,
        accountSection,
        pendingOrderDetailId,
        requestOrderDetail,
        consumeOrderDetail,
        materialsPreset,
        requestMaterialsPreset,
        consumeMaterialsPreset,
        postAuthDestination,
        setPostAuthDestination,

        startManufacturingRequest,
        leavingToWorkspace,
        openComingSoon,

        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,

        isPersonaModalOpen,
        openPersonaModal,
        closePersonaModal,

        isForgotPasswordOpen,
        openForgotPassword,
        closeForgotPassword,

        isComparisonModalOpen,
        openComparisonModal,
        closeComparisonModal,

        selectedOrder,
        isOrderTimelineOpen,
        openOrderTimeline,
        closeOrderTimeline,
        selectedOrderIds,
        toggleOrderSelection,
        clearOrderSelection,
        selectedAdminOrderId,
        selectedAdminCustomerId,
        selectedAdminManufacturerId,
        selectedAdminManufacturingRequestId,
        selectedAdminQuoteId,
        selectedAdminCadFileId,
        openAdminOrderDetail,
        openAdminCustomerDetail,
        openAdminManufacturerDetail,
        openAdminManufacturingRequestDetail,
        openAdminQuoteDetail,
        openAdminDeletionRequests,
        openAdminCadFileDetail,
        openAdminCouponDetail,
        closeAdminDetail,
        selectedAdminCouponId,
        submittedQuote,
        setSubmittedQuote,

        addCadFile,
        toggleComparison,
        clearComparison,
        showToast,
        removeToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
