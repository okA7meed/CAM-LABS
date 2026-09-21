import React from 'react';
import { Button } from '../ui/Button';
import { Icon, IconName } from '../../ui/Icon';
import { QUOTE_TONES } from './types';

export const QuoteHeader: React.FC<{
  quoteId: string;
  reference: string;
  status: string;
  fileNames: string[];
  onBack: () => void;
  onCopyReference: () => void;
}> = ({ quoteId, reference, status, fileNames, onBack, onCopyReference }) => {
  const tone = QUOTE_TONES[status] ?? 'unknown';
  const joined = fileNames.join(', ');
  // Up to 3 filenames inline; the rest collapse into a "+N more" hint so long
  // CAD lists never blow out the header (full list lives in Files below).
  const MAX_INLINE_FILES = 3;
  const inlineNames = fileNames.slice(0, MAX_INLINE_FILES).join(', ');
  const overflowCount = fileNames.length - MAX_INLINE_FILES;
  return (
    <div className="qd-header">
      <div className="qd-identity">
        <span className="qd-identity-icon" aria-hidden="true">
          <Icon name="file" size={26} />
        </span>
        <div className="qd-identity-text">
          <span className="qd-identity-label">Quote Details</span>
          <h1 className="qd-identity-id">
            <span title={quoteId !== reference ? `Internal ID: ${quoteId}` : undefined}>{reference}</span>
            <button
              type="button"
              className="qd-copy-btn"
              onClick={onCopyReference}
              title="Copy reference"
              aria-label="Copy quote reference"
            >
              <Icon name="copy" size={13} />
            </button>
            <span className={`status-badge status-${tone} qd-status-badge`}>
              <span className={`status-dot status-${tone}`} />
              {status}
            </span>
          </h1>
        </div>
      </div>
      <div className="qd-header-actions">
        <Button variant="outline" size="sm" icon="arrowLeft" onClick={onBack} className="qd-back-btn">
          Back to Quotes
        </Button>
      </div>
      {inlineNames && (
        <p className="qd-filenames" title={joined}>
          <Icon name="file" size={13} />
          <span>{inlineNames}{overflowCount > 0 ? ` +${overflowCount} more` : ''}</span>
        </p>
      )}
    </div>
  );
};

const MetaItem: React.FC<{
  icon: IconName;
  tone: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
}> = ({ icon, tone, label, value, sub }) => (
  <div className="qd-meta-item">
    <span className={`qd-meta-tile qd-tone-${tone}`} aria-hidden="true">
      <Icon name={icon} size={20} />
    </span>
    <div className="qd-meta-text">
      <span className="qd-meta-item-label">{label}</span>
      <span className="qd-meta-item-value" title={value}>{value}</span>
      {sub}
    </div>
  </div>
);

export const QuoteMetaCard: React.FC<{
  created: string;
  expiryLabel: string;
  expirySub: string | null;
  expiryExpired: boolean;
  currency: string;
  equationVersion: string;
}> = ({ created, expiryLabel, expirySub, expiryExpired, currency, equationVersion }) => (
  <div className="qd-meta-card" aria-label="Quote metadata">
    <MetaItem icon="calendar" tone="blue" label="Created" value={created} />
    <MetaItem
      icon="clock"
      tone="purple"
      label="Expiry"
      value={expiryLabel}
      sub={expirySub ? <span className={`qd-meta-item-sub${expiryExpired ? ' is-expired' : ''}`}>{expirySub}</span> : undefined}
    />
    <MetaItem icon="database" tone="cyan" label="Currency" value={currency} />
    <MetaItem icon="cpu" tone="purple" label="Equation Version" value={equationVersion} />
  </div>
);
