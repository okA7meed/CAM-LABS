import React from 'react';
import { SectionCard } from './SectionCard';
import type { PreferredPaymentMethod } from '../../../constants/locations';

interface Props {
  selected: PreferredPaymentMethod;
  onSelect: (m: PreferredPaymentMethod) => void;
}

export const PaymentMethodSection: React.FC<Props> = ({ selected, onSelect }) => (
  <SectionCard icon="card" title="Payment Method" subtitle="All transactions are secure and encrypted.">
    <div role="radiogroup" aria-label="Preferred payment method" className="sq-radio-stack">
      <button
        type="button"
        role="radio"
        aria-checked={selected === 'KASHIER'}
        onClick={() => onSelect('KASHIER')}
        className={`sq-radio-card${selected === 'KASHIER' ? ' is-active' : ''}`}
      >
        <span className="sq-radio-dot" aria-hidden="true" />
        <span className="sq-radio-text">
          <span className="sq-radio-title">Pay with Card, Wallet and Installment via Kashier</span>
          <span className="sq-radio-sub">You&apos;ll be redirected to Kashier to complete your purchase after approval</span>
        </span>
        <span className="sq-pay-badges" aria-hidden="true">
          <span className="sq-pay-badge sq-pay-visa">VISA</span>
          <span className="sq-pay-badge sq-pay-mc">
            <i />
            <i />
          </span>
          <span className="sq-pay-badge sq-pay-valu">valu</span>
          <span className="sq-pay-badge sq-pay-more">+3</span>
        </span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={selected === 'COD'}
        onClick={() => onSelect('COD')}
        className={`sq-radio-card${selected === 'COD' ? ' is-active' : ''}`}
      >
        <span className="sq-radio-dot" aria-hidden="true" />
        <span className="sq-radio-text">
          <span className="sq-radio-title">Cash on Delivery (COD)</span>
          <span className="sq-radio-sub">Pay when your order arrives</span>
        </span>
      </button>
    </div>
    <p className="sq-hint">This is your preferred payment method. No payment is charged when you submit a quote.</p>
  </SectionCard>
);
