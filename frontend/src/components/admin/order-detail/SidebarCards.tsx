import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../../ui/Icon';
import { StatusBadge, statusToneOf } from '../ui/StatusBadge';
import { copyText, extractCurrency, formatDateTime, initialsOf } from './format';
import { AdminOrderEvent, ORDER_PROGRESSION_STAGES, canEditOrderPrice } from './types';

/** Vertical lifecycle progression driven by the real order status + real events. */
export const OrderStatusCard: React.FC<{ status: string; createdAt?: string | null; events: AdminOrderEvent[] }> = ({
  status,
  createdAt,
  events,
}) => {
  const cancelled = status === 'Cancelled';
  const currentIndex = ORDER_PROGRESSION_STAGES.indexOf(status as (typeof ORDER_PROGRESSION_STAGES)[number]);

  const timestampFor = (stage: string, index: number): string | null => {
    if (index === 0) return createdAt || events[0]?.createdAt || null;
    const match = [...events].reverse().find((event) => {
      if (event.eventType === 'ORDER_APPROVED' && stage === 'In Production') return true;
      if (event.eventType === 'STATUS_UPDATE') {
        const meta = event.metadata as { status?: string; to?: string } | null;
        const next = meta?.status || meta?.to;
        if (next === stage) return true;
        return typeof event.description === 'string' && event.description.includes(stage);
      }
      return false;
    });
    return match ? match.createdAt : null;
  };

  return (
    <section className="admin-card od-card od-side-card" aria-label="Order status">
      <div className="admin-card-header">
        <div className="od-section-title">
          <Icon name="shieldCheck" size={15} />
          <h2 className="admin-card-title">Order Status</h2>
        </div>
      </div>
      <div className="admin-card-body">
        {cancelled ? (
          <div className="od-cancelled">
            <StatusBadge status="Cancelled" tone="cancelled" />
            <span className="admin-muted">This order was cancelled. Status changes remain available from Update Status.</span>
          </div>
        ) : (
          <ol className="od-progress">
            {ORDER_PROGRESSION_STAGES.map((stage, index) => {
              const done = currentIndex === -1 ? false : index < currentIndex;
              const current = index === currentIndex;
              const stamp = timestampFor(stage, index);
              const state = done ? 'done' : current ? 'current' : 'pending';
              return (
                <li key={stage} className={`od-progress-item od-progress-item--${state}`}>
                  <span className="od-progress-marker" aria-hidden="true">
                    {done ? <Icon name="check" size={11} /> : <span className="od-progress-dot" />}
                  </span>
                  <div className="od-progress-body">
                    <span className="od-progress-label">{stage}</span>
                    <span className="od-progress-date">{stamp ? formatDateTime(stamp) : 'Pending…'}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
};

export const CustomerCard: React.FC<{
  name?: string | null;
  email?: string | null;
  customerId?: string | null;
  onViewProfile: () => void;
  onCopied: (message: string) => void;
}> = ({ name, email, customerId, onViewProfile, onCopied }) => {
  const [copied, setCopied] = useState(false);
  const displayName = name || '—';

  const copyEmail = async () => {
    if (!email) return;
    const ok = await copyText(email);
    onCopied(ok ? 'Customer email copied' : 'Could not copy email');
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <section className="admin-card od-card od-side-card" aria-label="Customer">
      <div className="admin-card-header">
        <div className="od-section-title">
          <Icon name="users" size={15} />
          <h2 className="admin-card-title">Customer</h2>
        </div>
      </div>
      <div className="admin-card-body">
        <div className="od-customer-top">
          <span className="od-avatar" aria-hidden="true">{initialsOf(name, email)}</span>
          <div className="od-customer-id">
            <span className="od-customer-name" title={displayName}>{displayName}</span>
            {email ? (
              <span className="od-customer-email">
                <span className="od-ellipsis" title={email}>{email}</span>
                <button type="button" className="od-copy" title="Copy customer email" aria-label="Copy customer email" onClick={() => void copyEmail()}>
                  <Icon name={copied ? 'check' : 'copy'} size={12} />
                </button>
              </span>
            ) : null}
          </div>
        </div>
        <div className="od-customer-meta">
          <span className="od-customer-meta-label">Customer ID</span>
          <span className="od-mono od-ellipsis" title={customerId || ''}>{customerId || '—'}</span>
        </div>
        <Button variant="outline" size="sm" icon="eye" onClick={onViewProfile} disabled={!customerId}>
          View Profile →
        </Button>
      </div>
    </section>
  );
};

export const PricingCard: React.FC<{
  materialCost?: string | null;
  machineCost?: string | null;
  totalCost?: string | null;
  pricingVersion?: string | null;
  equationName?: string | null;
  events: AdminOrderEvent[];
  role?: string | null;
  onEdit: () => void;
}> = ({ materialCost, machineCost, totalCost, pricingVersion, equationName, events, role, onEdit }) => {
  const currency = extractCurrency(totalCost);
  const lastAdjustment = [...events].reverse().find((event) => event.eventType === 'PRICE_UPDATED');
  const editable = canEditOrderPrice(role);

  return (
    <section className="admin-card od-card od-side-card" aria-label="Pricing summary">
      <div className="admin-card-header">
        <div className="od-section-title">
          <Icon name="calculator" size={15} />
          <h2 className="admin-card-title">Pricing Summary</h2>
        </div>
        {editable && (
          <div className="admin-card-header-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={onEdit} title="Edit order price">
              <Icon name="configure" size={13} />
              Edit Price
            </button>
          </div>
        )}
      </div>
      <div className="admin-card-body">
        <div className="od-price-row">
          <span>Material Cost</span>
          <strong>{materialCost || '—'}</strong>
        </div>
        <div className="od-price-row">
          <span>Machine Cost</span>
          <strong>{machineCost || '—'}</strong>
        </div>
        <div className="od-price-row">
          <span>Final Price</span>
          <strong>{totalCost || '—'}</strong>
        </div>
        {(pricingVersion || equationName) && (
          <div className="od-price-meta">
            {pricingVersion ? <span>Version {pricingVersion}</span> : null}
            {equationName ? <span title={equationName}>{equationName}</span> : null}
          </div>
        )}
        {lastAdjustment && (
          <div className="od-price-audit">
            Last adjustment · {formatDateTime(lastAdjustment.createdAt)}
            {(lastAdjustment.metadata as { reason?: string } | null)?.reason
              ? ` · ${String((lastAdjustment.metadata as { reason?: string }).reason)}`
              : ''}
          </div>
        )}
        <div className="od-total-box">
          <span className="od-total-label">Total · {currency}</span>
          <strong className="od-total-value">{totalCost || '—'}</strong>
        </div>
      </div>
    </section>
  );
};

export const ManufacturingCard: React.FC<{
  manufacturingStatus?: string | null;
  shippingStatus?: string | null;
  paymentStatus?: string | null;
  requiredManufacturer?: string | null;
  manufacturers: Array<{ id: string; companyName: string; availability?: string }>;
  manufacturerId: string;
  onSelect: (id: string) => void;
  onSave: () => void;
  saving: boolean;
}> = ({ manufacturingStatus, shippingStatus, paymentStatus, requiredManufacturer, manufacturers, manufacturerId, onSelect, onSave, saving }) => (
  <section className="admin-card od-card od-side-card" aria-label="Manufacturing">
    <div className="admin-card-header">
      <div className="od-section-title">
        <Icon name="factory" size={15} />
        <h2 className="admin-card-title">Manufacturing</h2>
      </div>
    </div>
    <div className="admin-card-body">
      <div className="od-mfg-badges">
        <div className="od-mfg-row">
          <span>Manufacturing</span>
          <StatusBadge status={manufacturingStatus || '—'} tone={statusToneOf(manufacturingStatus || '')} />
        </div>
        <div className="od-mfg-row">
          <span>Shipping</span>
          <StatusBadge status={shippingStatus || '—'} tone={statusToneOf(shippingStatus || '')} />
        </div>
        <div className="od-mfg-row">
          <span>Payment</span>
          <StatusBadge status={paymentStatus || '—'} tone={statusToneOf(paymentStatus || '')} />
        </div>
      </div>
      <div className="od-customer-meta">
        <span className="od-customer-meta-label">Required Manufacturer</span>
        <span title={requiredManufacturer || ''}>{requiredManufacturer || 'Unassigned'}</span>
      </div>
      <label className="od-field-label" htmlFor="od-manufacturer-select">Assign / Reassign Manufacturer</label>
      <div className="od-mfg-assign">
        <select
          id="od-manufacturer-select"
          className="form-control"
          value={manufacturerId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">Select manufacturer</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.companyName}{m.availability ? ` — ${m.availability}` : ''}
            </option>
          ))}
        </select>
        <Button variant="primary" size="sm" onClick={onSave} disabled={!manufacturerId || saving} loading={saving}>
          Save
        </Button>
      </div>
    </div>
  </section>
);
