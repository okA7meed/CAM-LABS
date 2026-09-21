import React from 'react';
import { SectionCard } from './SectionCard';

export interface ShippingRateOption {
  id: string;
  label: string;
  description: string;
  eta: string;
  feeEgp: number;
}

interface Props {
  rates: ShippingRateOption[];
  selected: string;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
}

const fmt = (n: number) =>
  `EGP ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ShippingMethodSection: React.FC<Props> = ({ rates, selected, loading, error, onSelect, onRetry }) => (
  <SectionCard icon="truck" title="Shipping Method" subtitle="Choose how you want to receive your order.">
    <div role="radiogroup" aria-label="Shipping method" className="sq-radio-stack">
      {loading ? (
        <div className="sq-loading" role="status">
          Loading shipping rates…
        </div>
      ) : rates.length === 0 ? (
        <div className="sq-shipping-empty" role="alert">
          <p className="sq-error">{error || 'No shipping methods are available right now.'}</p>
          <button type="button" className="sq-edit" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : (
        rates.map((r) => {
          const active = selected === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(r.id)}
              className={`sq-radio-card${active ? ' is-active' : ''}`}
            >
              <span className="sq-radio-dot" aria-hidden="true" />
              <span className="sq-radio-text">
                <span className="sq-radio-title">{r.label}</span>
                <span className="sq-radio-sub">{r.description}</span>
              </span>
              <span className="sq-radio-price">{fmt(r.feeEgp)}</span>
            </button>
          );
        })
      )}
    </div>
  </SectionCard>
);
