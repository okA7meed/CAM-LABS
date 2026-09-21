import React from 'react';

interface Props {
  code: string;
  applying: boolean;
  applied: { code: string; discountAmount: number } | null;
  error: string | null;
  onCodeChange: (v: string) => void;
  onApply: () => void;
  onRemove: () => void;
}

export const DiscountCodeField: React.FC<Props> = ({ code, applying, applied, error, onCodeChange, onApply, onRemove }) => (
  <div className="sq-discount">
    {applied ? (
      <div className="sq-discount-applied" role="status">
        <span className="sq-discount-tag">
          {applied.code} — −{applied.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
        </span>
        <button type="button" className="sq-link" onClick={onRemove}>
          Remove
        </button>
      </div>
    ) : (
      <>
        <div className="sq-discount-row">
          <input
            className="sq-input"
            value={code}
            onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
            placeholder="Discount code"
            aria-label="Discount code"
            disabled={applying}
            maxLength={32}
          />
          <button type="button" className="sq-apply" onClick={onApply} disabled={applying || !code.trim()}>
            {applying ? 'Applying…' : 'Apply'}
          </button>
        </div>
        {error ? (
          <p className="sq-error" role="alert">
            {error}
          </p>
        ) : null}
      </>
    )}
  </div>
);
