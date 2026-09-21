import React from 'react';
import { useTranslation } from 'react-i18next';
import { Quote } from '../../types';
import { AnimatedModal } from '../ui/AnimatedModal';
import { formatRef } from './dashUtils';

/**
 * Shared deletion-REQUEST dialog (Dashboard + My Quotes, same policy/copy).
 * The Quote is NOT removed — a request goes to CAM LABS for approval.
 */
export const QuoteDeleteDialog: React.FC<{
  quote: Quote | null;
  reason: string;
  onReasonChange: (value: string) => void;
  busy: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ quote, reason, onReasonChange, busy, errorMessage, onCancel, onConfirm }) => {
  const { t } = useTranslation();
  return (
    <AnimatedModal open={quote !== null} role="alertdialog" ariaLabel={t('dashboard.deleteQuoteTitle')}>
      {quote && (
        <div className="account-modal">
          <h3>{t('dashboard.deleteQuoteTitle')}</h3>
          <dl className="dash-delete-context">
            <div>
              <dt>{t('dashboard.quoteRef')}</dt>
              <dd dir="ltr">{formatRef(quote.reference, quote.id)}</dd>
            </div>
            <div>
              <dt>{t('dashboard.quoteProduct')}</dt>
              <dd>{quote.partName}</dd>
            </div>
          </dl>
          <p className="account-muted">{t('dashboard.deleteQuoteBody')}</p>
          <label className="dash-delete-reason" htmlFor="quote-delete-reason">
            <span>{t('dashboard.deleteReasonLabel')}</span>
            <textarea
              id="quote-delete-reason"
              className="form-control"
              rows={3}
              maxLength={1000}
              value={reason}
              disabled={busy}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={t('dashboard.deleteReasonPlaceholder')}
            />
          </label>
          {errorMessage && (
            <p className="account-field-error" role="alert">
              {errorMessage}
            </p>
          )}
          <div className="account-modal-actions">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={onCancel}>
              {t('dashboard.cancel')}
            </button>
            <button type="button" className="btn account-btn-danger" disabled={busy} onClick={onConfirm}>
              {busy ? t('account.saving') : t('dashboard.deleteQuoteConfirm')}
            </button>
          </div>
        </div>
      )}
    </AnimatedModal>
  );
};
