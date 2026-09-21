import React, { useMemo, useState } from 'react';
import { ApiService } from '../../../services/api';
import { Icon } from '../../ui/Icon';

export const QuoteNotesCard: React.FC<{ notes?: string | null }> = ({ notes }) => (
  <section className="admin-card qd-card" aria-label="Technical notes">
    <div className="admin-card-header">
      <div className="qd-section-title">
        <span className="qd-title-icon" aria-hidden="true"><Icon name="file" size={15} /></span>
        <h2 className="admin-card-title">Technical Notes</h2>
      </div>
    </div>
    <div className="admin-card-body">
      {notes ? (
        <p className="qd-notes-text">{notes}</p>
      ) : (
        <p className="qd-empty-text">No technical notes were provided.</p>
      )}
    </div>
  </section>
);

export interface QuoteAttachment {
  id: string;
  name: string;
  mimeType?: string;
  byteSize?: number;
  scanStatus?: string;
}

export const QuoteAttachmentsCard: React.FC<{ documents: QuoteAttachment[] }> = ({ documents }) => (
  <section className="admin-card qd-card" aria-label="Attachments">
    <div className="admin-card-header">
      <div className="qd-section-title">
        <span className="qd-title-icon" aria-hidden="true"><Icon name="folder" size={15} /></span>
        <h2 className="admin-card-title">Attachments</h2>
      </div>
    </div>
    <div className="admin-card-body">
      {documents.length === 0 && <p className="qd-empty-text">No technical documents are attached to this quote.</p>}
      {documents.map((doc) => {
        const ext = (doc.name || '').split('.').pop()?.toUpperCase() || '';
        const size = doc.byteSize
          ? doc.byteSize < 1024 * 1024
            ? `${(doc.byteSize / 1024).toFixed(0)} KB`
            : `${(doc.byteSize / (1024 * 1024)).toFixed(2)} MB`
          : '';
        return (
          <div key={doc.id} className="qd-doc-row">
            <span className="qd-doc-name" title={doc.name}>{doc.name}</span>
            <span className="qd-doc-meta">{[doc.scanStatus === 'QUARANTINED' ? 'Quarantined' : '', ext, size].filter(Boolean).join(' · ')}</span>
            <a
              className="qd-link"
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
  </section>
);

export const RawJsonCard: React.FC<{ data: unknown; onCopied: () => void; onCopyFailed: () => void }> = ({ data, onCopied, onCopyFailed }) => {
  const [open, setOpen] = useState(false);
  const text = useMemo(() => JSON.stringify(data || {}, null, 2), [data]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied();
    } catch {
      onCopyFailed();
    }
  };

  return (
    <section className="admin-card qd-card" aria-label="Raw pricing data">
      <button
        type="button"
        className="qd-raw-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="qd-section-title">
          <span className="qd-title-icon" aria-hidden="true"><Icon name="cpu" size={15} /></span>
          <span>
            <span className="admin-card-title">Raw Pricing Data (JSON)</span>
            <span className="qd-raw-sub">View raw JSON data for debugging and analysis.</span>
          </span>
        </span>
        <Icon name="chevronDown" size={15} className={open ? 'qd-chevron-open' : ''} />
      </button>
      {open && (
        <div className="admin-card-body">
          <div className="qd-raw-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void copy()}>
              <Icon name="copy" size={13} />
              Copy JSON
            </button>
          </div>
          <pre className="qd-raw-pre">{text}</pre>
        </div>
      )}
    </section>
  );
};
