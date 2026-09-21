import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { Quote } from '../../types';
import { LegalPageShell } from '../legal/LegalPageShell';
import { Icon } from '../ui/Icon';
import { QuoteDetailModal } from '../dashboard/QuoteDetailModal';
import { QuoteDeleteDialog } from '../dashboard/QuoteDeleteDialog';
import { useQuoteDelete } from '../dashboard/useQuoteDelete';
import { isQuoteDeletable, hasPendingDeletionRequest } from '../dashboard/dashUtils';

/**
 * Customer "My Quotes" — read-only list of the signed-in customer's real
 * quotes (scoped server-side to the account). Guests get the real auth
 * gate with resume; approving/converting stays an admin operation.
 * Deletion shares the Dashboard policy/component/API exactly.
 */
export const CustomerQuotesView: React.FC = () => {
  const { t } = useTranslation();
  const { quotes, isCustomerDataLoading, refreshCustomerData, setActiveView, startManufacturingRequest, openAuthModal, setPostAuthDestination, showToast } = useStore();
  const { isAuthenticated } = useAuth();
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null);

  useEffect(() => {
    if (isAuthenticated) void refreshCustomerData();
  }, [isAuthenticated, refreshCustomerData]);

  const quoteDelete = useQuoteDelete((id) => {
    void refreshCustomerData();
    showToast(t('dashboard.deleteQuoteTitle'), t('dashboard.quoteDeleted'), 'success');
    if (detailQuote?.id === id) setDetailQuote(null);
  });

  const handleWorkspaceDeleted = (id: string) => {
    void refreshCustomerData();
    showToast(t('dashboard.deleteQuoteTitle'), t('dashboard.quoteDeleted'), 'success');
    if (detailQuote?.id === id) setDetailQuote(null);
  };

  const signIn = () => {
    setPostAuthDestination('quotes');
    openAuthModal('login');
  };

  return (
    <LegalPageShell
      viewId="view-quotes"
      eyebrowKey="myquotes.eyebrow"
      titleKey="myquotes.title"
      statementKey="myquotes.statement"
      toc={[]}
      hideContactCta
      hideFaqCta
    >
      {!isAuthenticated ? (
        <section className="quotes-gate" aria-label={t('myquotes.gateTitle')}>
          <span className="quotes-gate-icon" aria-hidden="true">
            <Icon name="file" size={26} />
          </span>
          <h2>{t('myquotes.gateTitle')}</h2>
          <p>{t('myquotes.gateSub')}</p>
          <button type="button" className="btn btn-primary" onClick={signIn}>
            {t('myquotes.signIn')}
          </button>
        </section>
      ) : isCustomerDataLoading && quotes.length === 0 ? (
        <div className="legal-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : quotes.length === 0 ? (
        <section className="quotes-empty" aria-label={t('myquotes.emptyTitle')}>
          <span className="quotes-gate-icon" aria-hidden="true">
            <Icon name="plusCircle" size={26} />
          </span>
          <h2>{t('myquotes.emptyTitle')}</h2>
          <p>{t('myquotes.emptySub')}</p>
          <button type="button" className="btn btn-primary" onClick={() => startManufacturingRequest()}>
            {t('myquotes.newQuote')}
          </button>
        </section>
      ) : (
        <>
          <p className="legal-lead">{t('myquotes.listLead', { count: quotes.length })}</p>
          <ul className="quotes-list">
            {quotes.map((quote) => (
              <li key={quote.id} className="quote-card">
                <div className="quote-card-main">
                  <strong className="quote-card-ref" dir="ltr">{quote.reference || quote.id}</strong>
                  <span className="quote-card-part">{quote.partName}</span>
                  <span className="quote-card-meta">
                    {quote.technology} · {quote.material} · {t('myquotes.qty', { count: quote.quantity })}
                  </span>
                </div>
                <div className="quote-card-side">
                  <span className="quote-card-total" dir="ltr">{quote.totalPrice}</span>
                  <span className={`quote-status is-${quote.status.replace(/\s+/g, '-').toLowerCase()}`}>
                    {quote.status}
                  </span>
                  {hasPendingDeletionRequest(quote) && (
                    <span className="quote-status is-pending-deletion">
                      {t('dashboard.deletionRequested')}
                    </span>
                  )}
                  <span className="quote-card-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetailQuote(quote)}>
                      {t('dashboard.viewDetails')}
                    </button>
                    {isQuoteDeletable(quote) && (
                      <button
                        type="button"
                        className="btn btn-sm account-btn-danger-ghost"
                        onClick={() => quoteDelete.askDelete(quote)}
                        aria-label={`${t('dashboard.deleteQuoteTitle')}: ${quote.reference || quote.id}`}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="quotes-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setActiveView('orders');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <Icon name="package" size={16} />
              {t('myquotes.viewOrders')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => startManufacturingRequest()}>
              <Icon name="plusCircle" size={16} />
              {t('myquotes.newQuote')}
            </button>
          </div>
        </>
      )}
      <QuoteDetailModal quote={detailQuote} onClose={() => setDetailQuote(null)} onDeleted={handleWorkspaceDeleted} />
      <QuoteDeleteDialog
        quote={quoteDelete.target}
        reason={quoteDelete.reason}
        onReasonChange={quoteDelete.setReason}
        busy={quoteDelete.busy}
        errorMessage={quoteDelete.errorCode === 'QUOTE_PROTECTED' ? t('dashboard.deleteProtected') : quoteDelete.errorMessage}
        onCancel={quoteDelete.cancel}
        onConfirm={() => void quoteDelete.confirm()}
      />
    </LegalPageShell>
  );
};
