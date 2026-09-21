import React from 'react';
import { CadFile } from '../../../types';
import { Icon, IconName } from '../../ui/Icon';
import { StatusBadge, statusToneOf } from '../ui/StatusBadge';
import { humanizeSpecValue } from './format';
import { AdminOrderCadEntry } from './types';
import { CadThumbnail } from './CadThumbnail';

const SPEC_ROWS: Array<{ key: string; label: string; icon: IconName }> = [
  { key: 'material', label: 'Material', icon: 'database' },
  { key: 'process', label: 'Process', icon: 'cpu' },
  { key: 'technology', label: 'Technology', icon: 'technology' },
  { key: 'finish', label: 'Finish', icon: 'surface' },
  { key: 'quality', label: 'Quality', icon: 'review' },
  { key: 'quantity', label: 'Quantity', icon: 'layers' },
  { key: 'tolerance', label: 'Tolerance', icon: 'precision' },
  { key: 'wallCount', label: 'Wall Count', icon: 'layers3' },
  { key: 'infillPercent', label: 'Infill', icon: 'chart' },
  { key: 'supportEnabled', label: 'Supports', icon: 'shieldCheck' },
  { key: 'color', label: 'Color', icon: 'plusCircle' },
];

const CadItemCard: React.FC<{
  entry: AdminOrderCadEntry;
  file: CadFile;
  onOpenViewer: (id: string) => void;
  onDownload: (file: CadFile) => void;
}> = ({ entry, file, onOpenViewer, onDownload }) => {
  const config = (entry.configuration || {}) as Record<string, unknown>;
  const half = Math.ceil(SPEC_ROWS.length / 2);
  const columns = [SPEC_ROWS.slice(0, half), SPEC_ROWS.slice(half)];

  return (
    <article className="od-cad-item" aria-label={`CAD file ${file.name}`}>
      <div className="od-cad-top">
        <button
          type="button"
          className="od-thumb"
          onClick={() => onOpenViewer(file.id)}
          title={`Open 3D preview of ${file.name}`}
          aria-label={`Open 3D preview of ${file.name}`}
        >
          <CadThumbnail file={file} label={file.name} />
          <span className="od-thumb-expand" aria-hidden="true">
            <Icon name="expand" size={12} />
          </span>
          <span className="od-thumb-format">{(file.format || '').toUpperCase()}</span>
        </button>
        <div className="od-cad-main">
          <div className="od-cad-title-row">
            <h3 className="od-cad-name" title={file.name}>{file.name}</h3>
            <StatusBadge status={file.status} tone={statusToneOf(file.status)} />
          </div>
          <div className="od-cad-meta">
            <span className="od-cad-meta-item">
              <Icon name="file" size={12} />
              {file.size || '—'}
            </span>
            <span className="od-cad-meta-sep" aria-hidden="true">·</span>
            <button type="button" className="od-link" onClick={() => onDownload(file)}>
              <Icon name="download" size={12} />
              Download
            </button>
            <span className="od-cad-meta-sep" aria-hidden="true">·</span>
            <button type="button" className="od-link" onClick={() => onOpenViewer(file.id)}>
              <Icon name="cube" size={12} />
              Open 3D
            </button>
          </div>
          <div className="od-cad-dims">
            <div className="od-cad-dim">
              <span className="od-cad-dim-label">Dimensions</span>
              <span className="od-cad-dim-value">{file.dimensions || '—'}</span>
            </div>
            <div className="od-cad-dim">
              <span className="od-cad-dim-label">Volume</span>
              <span className="od-cad-dim-value">{file.volume || '—'}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="od-spec-box">
        <h4 className="od-spec-title">Material &amp; Manufacturing Specifications</h4>
        <div className="od-spec-grid">
          {columns.map((col, colIndex) => (
            <div key={colIndex} className="od-spec-col">
              {col.map((row) => (
                <div key={row.key} className="od-spec-row">
                  <span className="od-spec-icon" aria-hidden="true">
                    <Icon name={row.icon} size={12} />
                  </span>
                  <span className="od-spec-label">{row.label}</span>
                  <span className="od-spec-value">{humanizeSpecValue(config[row.key])}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
};

export const CadItemsSection: React.FC<{
  entries: AdminOrderCadEntry[];
  files: CadFile[];
  onOpenViewer: (id: string) => void;
  onOpenViewerAll: () => void;
  onDownload: (file: CadFile) => void;
  onDownloadAll: () => void;
  downloadAllBusy: boolean;
}> = ({ entries, files, onOpenViewer, onOpenViewerAll, onDownload, onDownloadAll, downloadAllBusy }) => {
  const byId = new Map(files.map((file) => [file.id, file]));
  return (
    <section className="admin-card od-card" aria-label={`CAD items (${entries.length})`}>
      <div className="admin-card-header">
        <div className="od-section-title">
          <Icon name="cube" size={15} />
          <h2 className="admin-card-title">CAD Items ({entries.length})</h2>
        </div>
        <div className="admin-card-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onOpenViewerAll} disabled={files.length === 0}>
            <Icon name="cube" size={13} />
            View 3D
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onDownloadAll}
            disabled={files.length === 0 || downloadAllBusy}
            title="Download all CAD files"
          >
            {downloadAllBusy ? <Icon name="loader" size={13} className="admin-spin" /> : <Icon name="download" size={13} />}
            {downloadAllBusy ? 'Preparing…' : 'Download All'}
          </button>
        </div>
      </div>
      <div className="admin-card-body">
        {entries.length === 0 && (
          <div className="od-empty">
            <Icon name="cube" size={18} />
            <span>No CAD files linked to this order.</span>
          </div>
        )}
        <div className="od-cad-list">
          {entries.map((entry) => {
            const file = byId.get(entry.cadFileId);
            if (!file) return null;
            return (
              <CadItemCard
                key={entry.cadFileId}
                entry={entry}
                file={file}
                onOpenViewer={onOpenViewer}
                onDownload={onDownload}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};
