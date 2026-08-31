import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Order, Quote, CadFile, ToastMessage, ViewType } from '../types';
import { ApiService } from '../services/api';
import { useAuth } from './AuthContext';

interface StoreContextType {
  orders: Order[];
  quotes: Quote[];
  cadFiles: CadFile[];
  isCustomerDataLoading: boolean;
  refreshCustomerData: () => Promise<void>;
  comparisonList: string[];
  toasts: ToastMessage[];
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;

  // Modals state
  startManufacturingRequest: () => void;
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

  selectedAdminOrderId: string | null;
  selectedAdminCustomerId: string | null;
  selectedAdminManufacturerId: string | null;
  selectedAdminManufacturingRequestId: string | null;
  selectedAdminQuoteId: string | null;
  selectedAdminCadFileId: string | null;
  openAdminOrderDetail: (id: string) => void;
  openAdminCustomerDetail: (id: string) => void;
  openAdminManufacturerDetail: (id: string) => void;
  openAdminManufacturingRequestDetail: (id: string) => void;
  openAdminQuoteDetail: (id: string) => void;
  openAdminCadFileDetail: (id: string) => void;
  closeAdminDetail: () => void;

  // Actions
  approveQuote: (quoteId: string) => void;
  addCadFile: (fileData: Partial<CadFile>) => CadFile;
  toggleComparison: (materialId: string) => void;
  clearComparison: () => void;
  showToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const [activeView, setActiveView] = useState<ViewType>('home');

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
      if (freshQuotes) setQuotes(freshQuotes.filter((quote) => quote.status !== 'Approved'));
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

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderTimelineOpen, setIsOrderTimelineOpen] = useState(false);

  const [selectedAdminOrderId, setSelectedAdminOrderId] = useState<string | null>(null);
  const [selectedAdminCustomerId, setSelectedAdminCustomerId] = useState<string | null>(null);
  const [selectedAdminManufacturerId, setSelectedAdminManufacturerId] = useState<string | null>(null);
  const [selectedAdminManufacturingRequestId, setSelectedAdminManufacturingRequestId] = useState<string | null>(null);
  const [selectedAdminQuoteId, setSelectedAdminQuoteId] = useState<string | null>(null);
  const [selectedAdminCadFileId, setSelectedAdminCadFileId] = useState<string | null>(null);

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

  // Toast handler
  const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { id, title, message, type };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Modals controls
  const startManufacturingRequest = () => {
    setActiveView('manufacturing-request');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const openAdminCadFileDetail = (id: string) => {
    closeAdminDetail();
    setSelectedAdminCadFileId(id);
    setActiveView('admin-cad-file-detail');
  };

  // Data Actions
  const approveQuote = async (quoteId: string) => {
    const convert = async () => {
      try {
        const order = await ApiService.approveQuote(quoteId);
        setQuotes((prev) => prev.filter((quote) => quote.id !== quoteId));
        let ordersUpdated = false;
        if (order && order.id) {
          setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
          ordersUpdated = true;
        }
        try {
          const freshOrders = await ApiService.getOrders();
          if (freshOrders) {
            setOrders(freshOrders);
            ordersUpdated = true;
          }
        } catch {
          // Keep the converted order; the list refresh is best-effort.
        }
        return ordersUpdated;
      } catch (error: any) {
        showToast('Order Creation Failed', error?.message || 'Could not convert the quote to an order.', 'error');
        return false;
      }
    };

    const converted = await convert();
    if (converted) {
      showToast('Quote Converted to Order', `Quote ${quoteId} approved and transferred to automated manufacturing queue.`, 'success');
    }
  };

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

        startManufacturingRequest,
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
        openAdminCadFileDetail,
        closeAdminDetail,

        approveQuote,
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
