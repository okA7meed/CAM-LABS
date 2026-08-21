import React, { createContext, useContext, useState, useEffect } from 'react';
import { Order, Quote, CadFile, ToastMessage, ViewType } from '../types';
import { INITIAL_ORDERS, INITIAL_QUOTES, INITIAL_CAD_FILES } from '../data/initialData';
import { ApiService } from '../services/api';

interface StoreContextType {
  orders: Order[];
  quotes: Quote[];
  cadFiles: CadFile[];
  comparisonList: string[];
  toasts: ToastMessage[];
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;

  // Modals state
  startManufacturingRequest: () => void;

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

  // Actions
  addOrder: (orderData: Partial<Order>) => Order;
  addQuote: (quoteData: Partial<Quote>) => Quote;
  approveQuote: (quoteId: string) => void;
  addCadFile: (fileData: Partial<CadFile>) => CadFile;
  toggleComparison: (materialId: string) => void;
  clearComparison: () => void;
  showToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

const STORE_STORAGE_KEY = 'CAM_LABS_STORE_DATA_V1';

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<ViewType>('home');

  // Stored state
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const stored = localStorage.getItem(`${STORE_STORAGE_KEY}_ORDERS`);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Could not read stored orders:', e);
    }
    return INITIAL_ORDERS;
  });

  const [quotes, setQuotes] = useState<Quote[]>(() => {
    try {
      const stored = localStorage.getItem(`${STORE_STORAGE_KEY}_QUOTES`);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Could not read stored quotes:', e);
    }
    return INITIAL_QUOTES;
  });

  const [cadFiles, setCadFiles] = useState<CadFile[]>(() => {
    try {
      const stored = localStorage.getItem(`${STORE_STORAGE_KEY}_FILES`);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Could not read stored files:', e);
    }
    return INITIAL_CAD_FILES;
  });

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

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem(`${STORE_STORAGE_KEY}_ORDERS`, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(`${STORE_STORAGE_KEY}_QUOTES`, JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    localStorage.setItem(`${STORE_STORAGE_KEY}_FILES`, JSON.stringify(cadFiles));
  }, [cadFiles]);

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

  // Data Actions
  const addOrder = (orderData: Partial<Order>): Order => {
    const newOrder: Order = {
      id: `CAM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      partName: orderData.partName || 'Custom_Component.step',
      technology: orderData.technology || 'Industrial 3D Printing',
      material: orderData.material || 'PA 12 (Nylon 12)',
      quantity: orderData.quantity || 1,
      date: new Date().toISOString().split('T')[0],
      estDelivery: '2026-08-22',
      status: 'In Review',
      statusBadge: 'badge-blue',
      progressStep: 1,
      totalCost: orderData.totalCost || '240.00 EGP',
      tolerance: orderData.tolerance || '±0.05 mm',
      trackingNum: orderData.trackingNum || `CAM-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      history: [
        { step: 'CAD Geometry Verification', date: 'Just now', done: true, desc: 'Automated DFM verification confirmed by CAM LABS.' },
        { step: 'CAM Toolpath & Slicing', date: 'Pending', done: false, desc: 'Queued in CAM LABS internal production.' },
        { step: 'Fabrication & Sintering / Milling', date: 'Pending', done: false, desc: 'Manufacturing execution.' },
        { step: 'Zeiss CMM Laser QA Inspection', date: 'Pending', done: false, desc: 'Tolerance verification against ISO 2768.' },
        { step: 'Express Delivery Dispatch', date: 'Pending', done: false, desc: 'Global express courier dispatch.' },
      ],
      ...orderData,
    };

    setOrders((prev) => [newOrder, ...prev]);
    ApiService.createOrder(newOrder);
    return newOrder;
  };

  const addQuote = (quoteData: Partial<Quote>): Quote => {
    const validUntilDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const newQuote: Quote = {
      id: `RFQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      partName: quoteData.partName || 'Custom_Part.step',
      technology: quoteData.technology || 'CNC Machining',
      material: quoteData.material || 'Aluminum 6061-T6',
      quantity: quoteData.quantity || 5,
      leadTime: quoteData.leadTime || '3 - 5 Days',
      unitPrice: quoteData.unitPrice || '48.00 EGP',
      totalPrice: quoteData.totalPrice || '240.00 EGP',
      validUntil: validUntilDate,
      status: 'Ready for Approval',
      ...quoteData,
    };

    setQuotes((prev) => [newQuote, ...prev]);
    ApiService.createQuote(newQuote);
    return newQuote;
  };

  const approveQuote = (quoteId: string) => {
    const q = quotes.find((quote) => quote.id === quoteId);
    if (q) {
      addOrder({
        partName: q.partName,
        technology: q.technology,
        material: q.material,
        quantity: q.quantity,
        totalCost: q.totalPrice,
        tolerance: '±0.05 mm',
      });
      setQuotes((prev) => prev.filter((quote) => quote.id !== quoteId));
      ApiService.approveQuote(quoteId);
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
        comparisonList,
        toasts,
        activeView,
        setActiveView,

        startManufacturingRequest,

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

        addOrder,
        addQuote,
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
