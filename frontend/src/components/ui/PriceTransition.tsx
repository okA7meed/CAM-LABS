import React from 'react';

export type PriceStatus = 'idle' | 'calculating' | 'ready' | 'error';

interface PriceTransitionProps {
  status: PriceStatus;
  /** Formatted price to render once ready, e.g. "42.85 EGP". Value is only used for the ready state. */
  value?: React.ReactNode;
  calculatingLabel: string;
  errorLabel?: string;
  idleLabel?: React.ReactNode;
  className?: string;
  size?: 'md' | 'lg';
}

/**
 * Shared price recalculation transition used across every customer-facing price surface.
 * Renders exactly one of: idle placeholder, animated "calculating" state, error state, or the
 * settled price value — crossfading between them so the old price never lingers as if valid.
 */
export const PriceTransition: React.FC<PriceTransitionProps> = ({
  status,
  value,
  calculatingLabel,
  errorLabel,
  idleLabel = '—',
  className = '',
  size = 'md',
}) => {
  return (
    <span
      className={`price-transition price-transition-${size} is-${status} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {status === 'calculating' && (
        <span className="price-transition-face price-transition-calculating" key="calculating">
          <span className="price-transition-pulse" aria-hidden="true"><i /><i /><i /></span>
          <span className="price-transition-label">{calculatingLabel}</span>
        </span>
      )}
      {status === 'error' && (
        <span className="price-transition-face price-transition-error" key="error">
          {errorLabel || calculatingLabel}
        </span>
      )}
      {status === 'ready' && (
        <span className="price-transition-face price-transition-value" key={`ready-${String(value)}`}>
          {value}
        </span>
      )}
      {status === 'idle' && (
        <span className="price-transition-face price-transition-value price-transition-idle" key="idle">
          {idleLabel}
        </span>
      )}
    </span>
  );
};
