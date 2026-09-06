import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../context/StoreContext';
import { Icon } from '../../ui/Icon';

interface EligibleQuote {
  id: string;
  partName: string;
  technology: string;
  material: string;
  quantity: number;
  totalPrice: string;
  status: string;
  convertedOrderId: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string; company?: string | null };
}

interface CreateOrderModalProps {
  onClose: () => void;
  onConverted: () => void;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ onClose, onConverted }) => {
  const { t } = useTranslation();
  const { showToast } = useStore();
  const [quotes, setQuotes] = useState<EligibleQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadQuotes = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch('/api/v1/admin/quotes?status=Approved&limit=500', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to load quotes');
        const data = await res.json();
        const eligible = (data.data.quotes || []).filter((quote: EligibleQuote) => !quote.convertedOrderId);
        if (active) setQuotes(eligible);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadQuotes();
    return () => { active = false; };
  }, []);

  const convert = async () => {
    if (!selectedId || converting) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/from-quote/${selectedId}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || 'Conversion failed');
      }
      showToast(t('admin.orders.convertSuccessTitle'), t('admin.orders.convertSuccess'), 'success');
      onConverted();
    } catch (err: any) {
      showToast('Error', err?.message || t('admin.orders.convertFailed'), 'error');
    } finally {
      setConverting(false);
    }
  };

  const selectedQuote = quotes.find((quote) => quote.id === selectedId) || null;

  return (
    <div className="admin-modal-backdrop" onMouseDown={onClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('admin.orders.newOrder')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2>{t('admin.orders.newOrder')}</h2>
          <button type="button" className="cam-icon-btn" onClick={onClose} aria-label={t('admin.orders.close')}>
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="admin-modal-body">
          <p className="admin-modal-hint">{t('admin.orders.newOrderHint')}</p>

          {loading ? (
            <div className="admin-modal-state">
              <Icon name="loader" size={20} className="admin-spin" />
              {t('admin.orders.loadingQuotes')}
            </div>
          ) : error ? (
            <div className="admin-modal-state">
              {t('admin.orders.quotesLoadError')}
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => window.location.reload()}
              >
                {t('admin.orders.retry')}
              </button>
            </div>
          ) : quotes.length === 0 ? (
            <div className="admin-modal-state">
              <Icon name="file" size={22} />
              {t('admin.orders.noApprovedQuotes')}
            </div>
          ) : (
            <ul className="admin-quote-list">
              {quotes.map((quote) => (
                <li key={quote.id}>
                  <button
                    type="button"
                    className={`admin-quote-item ${selectedId === quote.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedId(quote.id)}
                    aria-pressed={selectedId === quote.id}
                  >
                    <span className="admin-quote-id">{quote.id}</span>
                    <span className="admin-quote-user">{quote.user?.name || '—'}</span>
                    <span className="admin-quote-part" title={quote.partName}>{quote.partName}</span>
                    <span className="admin-quote-meta">
                      <span className="badge badge-tech">{quote.technology}</span>
                      <span className="admin-muted">{quote.material}</span>
                      <span className="admin-muted">×{quote.quantity}</span>
                    </span>
                    <span className="admin-quote-total">{quote.totalPrice}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="admin-modal-footer">
          <button type="button" className="btn btn-sm btn-outline" onClick={onClose} disabled={converting}>
            {t('admin.orders.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={convert}
            disabled={!selectedQuote || converting || loading}
          >
            {converting ? t('admin.orders.converting') : t('admin.orders.confirmConvert')}
          </button>
        </div>
      </div>
    </div>
  );
};