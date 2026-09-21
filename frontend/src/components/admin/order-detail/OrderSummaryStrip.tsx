import React, { useState } from 'react';
import { Icon, IconName } from '../../ui/Icon';
import { copyText, extractCurrency, formatPlacedOn } from './format';

const Cell: React.FC<{ icon: IconName; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div className="od-sum-cell">
    <span className="od-sum-icon" aria-hidden="true">
      <Icon name={icon} size={15} />
    </span>
    <div className="od-sum-body">
      <span className="od-sum-label">{label}</span>
      <span className="od-sum-value">{children}</span>
    </div>
  </div>
);

export const OrderSummaryStrip: React.FC<{
  orderId: string;
  customerName: string;
  customerEmail: string;
  createdAt?: string | null;
  totalCost?: string | null;
  onCopied: (message: string) => void;
}> = ({ orderId, customerName, customerEmail, createdAt, totalCost, onCopied }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (key: string, value: string, label: string) => {
    const ok = await copyText(value);
    if (ok) {
      setCopiedKey(key);
      onCopied(`${label} copied`);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
    } else {
      onCopied(`Could not copy ${label.toLowerCase()}`);
    }
  };

  return (
    <section className="od-summary" aria-label="Order summary">
      <Cell icon="cube" label="Order ID">
        <span className="od-mono" title={orderId}>{orderId}</span>
        <button
          type="button"
          className="od-copy"
          title="Copy order ID"
          aria-label="Copy order ID"
          onClick={() => void copy('id', orderId, 'Order ID')}
        >
          <Icon name={copiedKey === 'id' ? 'check' : 'copy'} size={12} />
        </button>
      </Cell>
      <Cell icon="users" label="Customer">
        <span className="od-sum-main" title={customerName}>{customerName || '—'}</span>
        {customerEmail ? (
          <span className="od-sum-sub">
            <span className="od-ellipsis" title={customerEmail}>{customerEmail}</span>
            <button
              type="button"
              className="od-copy"
              title="Copy customer email"
              aria-label="Copy customer email"
              onClick={() => void copy('email', customerEmail, 'Customer email')}
            >
              <Icon name={copiedKey === 'email' ? 'check' : 'copy'} size={12} />
            </button>
          </span>
        ) : null}
      </Cell>
      <Cell icon="calendar" label="Created">
        <span title={createdAt || ''}>{formatPlacedOn(createdAt)}</span>
      </Cell>
      <Cell icon="database" label="Total Price">
        <span className="od-sum-strong">{totalCost || '—'}</span>
      </Cell>
      <Cell icon="plusCircle" label="Currency">
        <span>{extractCurrency(totalCost)}</span>
      </Cell>
    </section>
  );
};
