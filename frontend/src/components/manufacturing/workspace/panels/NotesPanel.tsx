import { ApiService } from '../../../../services/api';
import { Icon } from '../../../ui/Icon';
import { formatBytes } from '../helpers';
import { PanelShell } from '../PanelShell';
import { panelIds } from '../constants';
import { TechnicalDocumentItem } from '../types';

export const NotesPanel = ({ note, onNoteChange, documents, isDragging, onBrowse, onDocs, onDragState, onRemove, onPreview }: {
  note: string;
  onNoteChange: (n: string) => void;
  documents: TechnicalDocumentItem[];
  isDragging: boolean;
  onBrowse: () => void;
  onDocs: (files: File[]) => void;
  onDragState: (dragging: boolean) => void;
  onRemove: (key: string) => void;
  onPreview: (doc: TechnicalDocumentItem) => void;
}) => {
  const uploadingCount = documents.filter((d) => d.status === 'uploading').length;
  return (
    <PanelShell
      id={panelIds.notes}
      icon="file"
      title="Technical Drawings & Notes"
      subtitle="Add notes, drawings or special requirements about your design"
      className="mw-panel-notes"
    >
      <div className="mw-stage-notes-callout">Add references, drawing numbers, datasheets, or manufacturing instructions for your part.</div>
      <textarea
        className="mw-stage-notes"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Add drawings, special requirements or notes about your design…"
        rows={2}
        maxLength={500}
      />
      <div className="mw-stage-notes-foot">
        <span>{note.length}/500</span>
      </div>

      <div className="mw-docs-head">
        <span className="mw-docs-head-label">Technical Documents</span>
        <span className="mw-docs-head-count">{documents.filter((d) => d.status !== 'error').length}/10</span>
      </div>

      <div
        className={`mw-doc-dropzone ${isDragging ? 'is-dragging' : ''}`}
        role="button"
        tabIndex={uploadingCount > 0 ? -1 : 0}
        aria-disabled={uploadingCount > 0}
        title="Click to browse or drag & drop technical documents"
        onClick={() => { if (uploadingCount === 0) onBrowse(); }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && uploadingCount === 0) { e.preventDefault(); onBrowse(); } }}
        onDragEnter={(e) => { e.preventDefault(); onDragState(true); }}
        onDragOver={(e) => { e.preventDefault(); onDragState(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDragState(false); }}
        onDrop={(e) => { e.preventDefault(); onDragState(false); if (uploadingCount === 0) onDocs(Array.from(e.dataTransfer.files || [])); }}
      >
        <span className="mw-doc-dropzone-icon" aria-hidden="true"><Icon name="upload" size={16} /></span>
        <div className="mw-doc-dropzone-text">
          <button type="button" className="mw-doc-browse-btn" onClick={(e) => { e.stopPropagation(); onBrowse(); }} disabled={uploadingCount > 0}>Browse files</button>
          <span className="mw-doc-dropzone-hint">or drop PDF, DOC, DOCX, TXT, RTF, PNG, JPG · max 10 · 10MB each</span>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="mw-doc-list">
          {documents.map((doc) => {
            const ext = doc.name.split('.').pop()?.toUpperCase() || '';
            const sub = doc.status === 'uploading'
              ? `Uploading ${doc.progress}%`
              : doc.status === 'error'
                ? (doc.message || 'Upload failed.')
                : `${ext} · ${formatBytes(doc.byteSize)}`;
            return (
              <div key={doc.key} className={`mw-doc-item is-${doc.status}`}>
                <span className="mw-doc-item-icon" aria-hidden="true">
                  <Icon name={doc.status === 'uploading' ? 'loader' : 'file'} size={13} />
                </span>
                <span className="mw-doc-item-meta">
                  <span className="mw-doc-item-name" title={doc.name}>{doc.name}</span>
                  <span className="mw-doc-item-sub">{sub}</span>
                </span>
                {doc.status === 'uploading' && (
                  <span className="mw-doc-item-progress" aria-hidden="true">
                    <span className="mw-doc-item-progress-bar" style={{ width: `${doc.progress}%` }} />
                  </span>
                )}
                {doc.status === 'ready' && doc.id && (
                  <span className="mw-doc-item-actions">
                    <button type="button" className="mw-doc-item-preview" onClick={(e) => { e.stopPropagation(); onPreview(doc); }} aria-label={`Preview ${doc.name}`} title="Preview document">
                      <Icon name="eye" size={12} /> Preview
                    </button>
                    <a
                      className="mw-doc-item-open"
                      href={ApiService.getTechnicalDocumentDownloadUrl(doc.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Download ${doc.name}`}
                      title="Download document"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon name="download" size={13} />
                    </a>
                  </span>
                )}
                <button type="button" className="mw-doc-item-remove" onClick={(e) => { e.stopPropagation(); onRemove(doc.key); }} aria-label={`Remove ${doc.name}`} title="Remove document">
                  <Icon name="trash" size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
};