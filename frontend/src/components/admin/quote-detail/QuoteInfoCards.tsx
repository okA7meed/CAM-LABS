import React from 'react';
import { Icon } from '../../ui/Icon';
import { fmtEgp } from './format';
import {
  DeliveryInfoVM,
  QuotePricingVM,
  ShippingInfoVM,
} from './types';

const statusTone = (status?: string | null): string => {
  if (status === 'ACTIVE') return 'delivered';
  if (status === 'SUSPENDED') return 'cancelled';
  return 'unknown';
};

const statusLabel = (status?: string | null): string => {
  if (!status) return '—';
  if (status === 'ACTIVE') return 'Active';
  return status.charAt(0) + status.slice(1).toLowerCase();
};

/* ------------------------------------------------------------------ */
/* Customer Information — single source for identity/contact.          */
/* Live account data (name/email/phone/status) meets the quote here;   */
/* historic commercial facts live in the cards below. UUIDs and the    */
/* internal RFQ id never appear in this primary presentation.          */
/* ------------------------------------------------------------------ */

export const QuoteCustomerInfoCard: React.FC<{
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  accountStatus?: string | null;
  onViewCustomer?: (() => void) | null;
}> = ({ name, email, phone, accountStatus, onViewCustomer }) => (
  <section className="admin-card qd-card" aria-label="Customer information">
    <div className="admin-card-header">
      <div className="qd-section-title">
        <span className="qd-title-icon" aria-hidden="true"><Icon name="users" size={15} /></span>
        <h2 className="admin-card-title">Customer Information</h2>
      </div>
      {onViewCustomer ? (
        <div className="admin-card-header-actions">
          <button type="button" className="qd-link" onClick={onViewCustomer}>
            View Customer <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}
    </div>
    <div className="admin-card-body">
      <div className="qd-customer-grid">
        <div className="qd-customer-cell">
          <span className="qd-customer-row"><Icon name="users" size={13} /><span className="qd-customer-label">Name</span></span>
          <strong className="qd-customer-value" title={name || ''}>{name || '—'}</strong>
        </div>
        <div className="qd-customer-cell">
          <span className="qd-customer-row"><Icon name="mail" size={13} /><span className="qd-customer-label">Email</span></span>
          <span className="qd-customer-value qd-customer-mail" title={email || ''}><Icon name="mail" size={13} />{email || '—'}</span>
        </div>
        <div className="qd-customer-cell">
          <span className="qd-customer-row"><Icon name="phone" size={13} /><span className="qd-customer-label">Phone</span></span>
          <span className="qd-customer-value" title={phone || ''}><Icon name="phone" size={13} />{phone || '—'}</span>
        </div>
        <div className="qd-customer-cell">
          <span className="qd-customer-row"><span className="qd-customer-label">Account Status</span></span>
          <span>
            <span className={`status-badge status-${statusTone(accountStatus)}`}>
              <span className={`status-dot status-${statusTone(accountStatus)}`} />
              {statusLabel(accountStatus)}
            </span>
          </span>
        </div>
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Shared info-card shell for Delivery / Shipping / Payment / Pricing. */
/* ------------------------------------------------------------------ */

const InfoCard: React.FC<{
  icon: 'mapPin' | 'send' | 'wallet' | 'calculator';
  title: string;
  label: string;
  children: React.ReactNode;
}> = ({ icon, title, label, children }) => (
  <section className="admin-card qd-card qd-info-card" aria-label={label}>
    <div className="admin-card-header">
      <div className="qd-section-title">
        <span className="qd-title-icon qd-info-icon" aria-hidden="true"><Icon name={icon} size={17} /></span>
        <h2 className="admin-card-title">{title}</h2>
      </div>
    </div>
    <div className="admin-card-body qd-info-body">{children}</div>
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode; dirAuto?: boolean }> = ({ label, children, dirAuto }) => (
  <div className="qd-info-field">
    <span className="qd-info-label">{label}</span>
    <span className="qd-info-value" dir={dirAuto ? 'auto' : undefined}>{children}</span>
  </div>
);

/* ------------------------------------------------------------------ */
/* Delivery Details — immutable submission snapshot (never the live    */
/* profile address). Optional rows render only when present.           */
/* ------------------------------------------------------------------ */

export const QuoteDeliveryCard: React.FC<{ delivery: DeliveryInfoVM }> = ({ delivery }) => {
  const cityLine = [delivery.city, delivery.governorate].filter(Boolean).join(', ') || null;
  return (
    <InfoCard icon="mapPin" title="Delivery Details" label="Delivery details">
      <Field label="Address" dirAuto>
        {delivery.address || <span className="qd-empty-inline">—</span>}
      </Field>
      {cityLine ? <Field label="City / Governorate" dirAuto>{cityLine}</Field> : null}
      {delivery.country ? <Field label="Country">{delivery.country}</Field> : null}
      {delivery.apartment ? <Field label="Apartment / Suite" dirAuto>{delivery.apartment}</Field> : null}
      {delivery.postalCode ? <Field label="Postal Code">{delivery.postalCode}</Field> : null}
    </InfoCard>
  );
};

/* ------------------------------------------------------------------ */
/* Shipping — historical method snapshot (name/ETA/amount frozen at    */
/* submission; later Super Admin edits never rewrite history).         */
/* ------------------------------------------------------------------ */

export const QuoteShippingCard: React.FC<{ shipping: ShippingInfoVM }> = ({ shipping }) => (
  <InfoCard icon="send" title="Shipping" label="Shipping">
    <Field label="Method">{shipping.name}</Field>
    {shipping.eta ? <Field label="Delivery Estimate">{shipping.eta}</Field> : null}
    <Field label="Applied Amount">
      <strong className="qd-info-strong">{shipping.amount !== null ? fmtEgp(shipping.amount) : '—'}</strong>
    </Field>
  </InfoCard>
);

/* ------------------------------------------------------------------ */
/* Payment — PREFERRED method at quote stage; never implies a charge.  */
/* ------------------------------------------------------------------ */

export const QuotePaymentCard: React.FC<{ methodLabel: string }> = ({ methodLabel }) => (
  <InfoCard icon="wallet" title="Payment" label="Payment">
    <Field label="Preferred Method">
      <strong className="qd-info-strong">{methodLabel}</strong>
    </Field>
    <p className="qd-info-note">No charge at quote stage</p>
  </InfoCard>
);

/* ------------------------------------------------------------------ */
/* Pricing Summary — the single authoritative commercial breakdown:    */
/*   Estimated Total = Subtotal + Shipping − Discount                  */
/* All rows derive from server snapshots; the frontend never invents   */
/* its own formula (a subtotal that already folds shipping in and then */
/* adds it again is exactly how phantom totals appear).                */
/* ------------------------------------------------------------------ */

export const QuotePricingCard: React.FC<{ pricing: QuotePricingVM; currentTotal?: string | null; adjusted?: boolean }> = ({ pricing, currentTotal, adjusted }) => (
  <InfoCard icon="calculator" title="Pricing Summary" label="Pricing summary">
    <div className="qd-price-row">
      <span>Subtotal</span>
      <strong>{fmtEgp(pricing.subtotal)}</strong>
    </div>
    <div className="qd-price-row">
      <span>Shipping</span>
      <strong>{fmtEgp(pricing.shipping)}</strong>
    </div>
    {pricing.hasCoupon && pricing.couponCode ? (
      <div className="qd-price-row is-discount">
        <span>Coupon ({pricing.couponCode})</span>
        <strong>−{fmtEgp(pricing.discount)}</strong>
      </div>
    ) : null}
    <div className="qd-total-box">
      <span>Estimated Total</span>
      <strong>{currentTotal || fmtEgp(pricing.storedEstimated ?? pricing.estimated)}</strong>
    </div>
    {adjusted ? <p className="qd-info-note">Manually adjusted — breakdown shows the submission estimate.</p> : null}
  </InfoCard>
);
