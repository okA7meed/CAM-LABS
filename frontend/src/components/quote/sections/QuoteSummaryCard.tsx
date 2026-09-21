import React from 'react';
import { useStore } from '../../../context/StoreContext';
import { DiscountCodeField } from './DiscountCodeField';

export interface SummaryItem {
  id: string;
  fileId: string;
  name: string;
  meta: string;
  quantity: number;
  priceText: string;
  thumbUrl: string | null;
  thumbState: 'ready' | 'loading' | 'processing' | 'failed';
}

interface Props {
  items: SummaryItem[];
  itemCountText: string;
  subtotalText: string;
  shippingText: string;
  discountText: string | null;
  estimatedTotalText: string;
  couponCode: string;
  couponApplying: boolean;
  couponApplied: { code: string; discountAmount: number } | null;
  couponError: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onCouponCodeChange: (v: string) => void;
  onCouponApply: () => void;
  onCouponRemove: () => void;
  onEditItems: () => void;
  onSubmit: () => void;
  submitError: string | null;
}

const fmtRow = (label: string, value: string) => (
  <div className="sq-sum-row">
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const TermsPrivacyLinks: React.FC = () => {
  const { setActiveView } = useStore();
  const go = (view: 'terms' | 'privacy') => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <>
      <button type="button" className="sq-terms-link" onClick={() => go('terms')}>Terms of Service</button>
      {' and '}
      <button type="button" className="sq-terms-link" onClick={() => go('privacy')}>Privacy Policy</button>
      .
    </>
  );
};

export const QuoteSummaryCard: React.FC<Props> = ({
  items,
  itemCountText,
  subtotalText,
  shippingText,
  discountText,
  estimatedTotalText,
  couponCode,
  couponApplying,
  couponApplied,
  couponError,
  submitting,
  canSubmit,
  onCouponCodeChange,
  onCouponApply,
  onCouponRemove,
  onEditItems,
  onSubmit,
  submitError,
}) => (
  <aside className="sq-summary" aria-label="Quote Summary">
    <div className="sq-summary-head">
      <span className="sq-icon" aria-hidden="true">
        <span className="sq-glyph sq-glyph-cart" />
      </span>
      <span className="sq-head-text">
        <span className="sq-card-title">Quote Summary</span>
        <span className="sq-card-sub">{itemCountText}</span>
      </span>
      <button type="button" className="sq-edit" onClick={onEditItems}>
        Edit Items
      </button>
    </div>

    <div className="sq-sum-items">
      {items.length === 0 ? (
        <p className="sq-hint">No items found. Return to the workspace to configure your quote.</p>
      ) : (
        items.map((it) => (
          <div key={it.id} className="sq-sum-item">
            <span className={`sq-sum-thumb is-${it.thumbState}`} aria-hidden="true">
              {it.thumbState === 'ready' && it.thumbUrl ? (
                <img className="sq-sum-thumb-img" src={it.thumbUrl} alt="" />
              ) : it.thumbState === 'loading' || it.thumbState === 'processing' ? (
                <span className="sq-sum-thumb-loader" role="status" aria-label={it.thumbState === 'processing' ? 'CAD processing' : 'Loading preview'} />
              ) : (
                <svg className="sq-sum-thumb-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3L18.7 8 12 11.7 5.3 8 12 4.3zM5 9.7l6 3.4v6.5l-6-3.4V9.7zm8 9.9v-6.5l6-3.4v6.5l-6 3.4z"
                  />
                </svg>
              )}
            </span>
            <span className="sq-sum-info">
              <span className="sq-sum-name" title={it.name}>
                {it.name}
              </span>
              <span className="sq-sum-meta">
                {it.meta} · Qty {it.quantity}
              </span>
              {it.thumbState === 'processing' ? (
                <span className="sq-sum-thumb-note">Processing geometry…</span>
              ) : null}
            </span>
            <span className="sq-sum-price">{it.priceText}</span>
          </div>
        ))
      )}
    </div>

    <DiscountCodeField
      code={couponCode}
      applying={couponApplying}
      applied={couponApplied}
      error={couponError}
      onCodeChange={onCouponCodeChange}
      onApply={onCouponApply}
      onRemove={onCouponRemove}
    />

    <div className="sq-sum-totals">
      {fmtRow('Subtotal', subtotalText)}
      {discountText ? (
        <div className="sq-sum-row is-discount">
          <span>Discount</span>
          <span>{discountText}</span>
        </div>
      ) : null}
      <div className="sq-sum-row">
        <span>
          Shipping <span className="sq-info" title="Authoritative server-calculated shipping">ⓘ</span>
        </span>
        <span>{shippingText}</span>
      </div>
      <div className="sq-sum-total">
        <span>Estimated Total</span>
        <span className="sq-sum-total-value">{estimatedTotalText}</span>
      </div>
      <p className="sq-hint">Estimated total — final price is confirmed by CAM LABS after review.</p>
    </div>

    <button type="button" className="sq-submit" onClick={onSubmit} disabled={submitting || !canSubmit}>
      {submitting ? 'Submitting…' : 'Submit Quote →'}
    </button>
    {submitError ? (
      <p className="sq-error" role="alert">
        {submitError}
      </p>
    ) : null}
    <p className="sq-terms">By submitting this quote, you agree to our <TermsPrivacyLinks /></p>
  </aside>
);
