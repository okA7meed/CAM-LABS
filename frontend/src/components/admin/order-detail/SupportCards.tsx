import React, { useState } from 'react';
import { ApiService } from '../../../services/api';
import { Icon } from '../../ui/Icon';
import { AnimatedModal } from '../../ui/AnimatedModal';
import { formatDateTime, humanizeSpecValue } from './format';
import { AdminOrderEvent } from './types';

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order Created',
  CAD_UPLOADED: 'CAD Uploaded',
  QUOTE_GENERATED: 'Quote Generated',
  ORDER_CONFIRMED: 'Order Confirmed',
  ORDER_APPROVED: 'Order Approved',
  MANUFACTURER_ASSIGNED: 'Manufacturer Assigned',
  PRODUCTION_STARTED: 'Production Started',
  PRODUCTION_COMPLETED: 'Production Completed',
  QA_PASSED: 'QA Passed',
  QA_FAILED: 'QA Failed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  STATUS_UPDATE: 'Status Updated',
  PRICE_UPDATED: 'Price Adjusted',
  CUSTOMER_MESSAGE: 'Message to Customer',
};

export const eventDisplayLabel = (eventType: string): string =>
  EVENT_LABELS[eventType] ||
  eventType
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const TechNotesDocsCard: React.FC<{
  notes?: string | null;
  documents: Array<{ id: string; name: string; mimeType?: string; byteSize?: number; scanStatus?: string }>;
}> = ({ notes, documents }) => (
  <section className="admin-card od-card" aria-label="Technical notes and documents">
    <div className="admin-card-header">
      <div className="od-section-title">
        <Icon name="file" size={15} />
        <h2 className="admin-card-title">Technical Notes &amp; Documents</h2>
      </div>
    </div>
    <div className="admin-card-body">
      <div className="od-mini-box">
        <div className="od-mini-head">
          <Icon name="clipboard" size={13} />
          <span>Technical Notes</span>
        </div>
        {notes ? (
          <p className="od-mini-text">{notes}</p>
        ) : (
          <p className="od-mini-empty">No technical notes were provided.</p>
        )}
      </div>
      <div className="od-mini-box">
        <div className="od-mini-head">
          <Icon name="folder" size={13} />
          <span>Documents</span>
        </div>
        {documents.length === 0 && <p className="od-mini-empty">No technical documents are attached to this order.</p>}
        {documents.map((doc) => {
          const ext = (doc.name || '').split('.').pop()?.toUpperCase() || '';
          const size = doc.byteSize
            ? doc.byteSize < 1024 * 1024
              ? `${(doc.byteSize / 1024).toFixed(0)} KB`
              : `${(doc.byteSize / (1024 * 1024)).toFixed(2)} MB`
            : '';
          return (
            <div key={doc.id} className="od-doc-row">
              <span className="od-doc-name" title={doc.name}>{doc.name}</span>
              <span className="od-doc-meta">{[doc.scanStatus === 'QUARANTINED' ? 'Quarantined' : '', ext, size].filter(Boolean).join(' · ')}</span>
              <a
                className="od-link"
                href={ApiService.getTechnicalDocumentDownloadUrl(doc.id)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Download ${doc.name}`}
              >
                <Icon name="download" size={12} />
                Download
              </a>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export const ConfigCard: React.FC<{ order: Record<string, unknown> }> = ({ order }) => {
  const rows: Array<[string, unknown]> = [
    ['Technology', humanizeSpecValue(order.technology)],
    ['Material', humanizeSpecValue(order.material)],
    ['Quantity', humanizeSpecValue(order.quantity)],
    ['Tolerance', humanizeSpecValue(order.tolerance)],
    ['Shipping Method', humanizeSpecValue(order.shippingMethod)],
    ['Shipping Address', humanizeSpecValue(order.shippingAddress)],
    ['Provider', humanizeSpecValue(order.provider)],
  ];
  return (
    <section className="admin-card od-card" aria-label="Configuration">
      <div className="admin-card-header">
        <div className="od-section-title">
          <Icon name="configure" size={15} />
          <h2 className="admin-card-title">Configuration</h2>
        </div>
      </div>
      <div className="admin-card-body">
        <dl className="od-config">
          {rows.map(([label, value]) => (
            <div key={label} className="od-config-row">
              <dt>{label}</dt>
              <dd title={String(value)}>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export const TimelineCard: React.FC<{ events: AdminOrderEvent[] }> = ({ events }) => {
  const [fullOpen, setFullOpen] = useState(false);
  const preview = events.slice(0, 5);

  const renderEvent = (event: AdminOrderEvent, detailed: boolean) => {
    const priceMeta = event.metadata as { previousPrice?: string; newPrice?: string; reason?: string; changedByName?: string } | null;
    return (
      <li key={event.id} className="od-tl-item">
        <span className={`od-tl-dot od-tl-dot--${event.eventType === 'PRICE_UPDATED' ? 'amber' : event.eventType === 'CUSTOMER_MESSAGE' ? 'blue' : 'green'}`} aria-hidden="true" />
        <div className="od-tl-body">
          <span className="od-tl-title">{eventDisplayLabel(event.eventType)}</span>
          {detailed && event.description ? <span className="od-tl-desc">{event.description}</span> : null}
          {event.eventType === 'PRICE_UPDATED' && priceMeta?.previousPrice ? (
            <span className="od-tl-desc">
              {priceMeta.previousPrice} → {priceMeta.newPrice || ''}
              {priceMeta.reason ? ` · ${String(priceMeta.reason)}` : ''}
            </span>
          ) : null}
          <span className="od-tl-date">{formatDateTime(event.createdAt)}</span>
        </div>
      </li>
    );
  };

  return (
    <section className="admin-card od-card" aria-label="Timeline and history">
      <div className="admin-card-header">
        <div className="od-section-title">
          <Icon name="clock" size={15} />
          <h2 className="admin-card-title">Timeline / History</h2>
        </div>
        {events.length > 5 && (
          <div className="admin-card-header-actions">
            <button type="button" className="od-link" onClick={() => setFullOpen(true)}>
              View full history →
            </button>
          </div>
        )}
      </div>
      <div className="admin-card-body">
        {events.length === 0 && (
          <div className="od-empty">
            <Icon name="clock" size={18} />
            <span>No timeline events available.</span>
          </div>
        )}
        <ul className="od-tl">{preview.map((event) => renderEvent(event, false))}</ul>
      </div>
      <AnimatedModal
        open={fullOpen}
        role="dialog"
        ariaLabel="Full order history"
        onOverlayMouseDown={(e) => {
          if (e.target === e.currentTarget) setFullOpen(false);
        }}
      >
        <div className="modal-header">
          <h3 className="modal-title">Full order history</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setFullOpen(false)} aria-label="Close full history">
            <Icon name="close" size={13} />
            Close
          </button>
        </div>
        <div className="modal-body">
          <ul className="od-tl">{events.map((event) => renderEvent(event, true))}</ul>
        </div>
      </AnimatedModal>
    </section>
  );
};
