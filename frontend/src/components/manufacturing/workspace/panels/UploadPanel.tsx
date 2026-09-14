import { DragEvent, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CAM_EASE } from '../../../ui/AnimatedModal';
import { Icon } from '../../../ui/Icon';
import { CadFile } from '../../../../types';
import { isUploadItemThumbnailReady, isUploadItemReady } from '../../uploadState';
import { PanelShell } from '../PanelShell';
import { PROCESS_INFO, panelIds } from '../constants';
import { FileConfiguration, PanelStatus, ProcessId, RequestState, UploadItem } from '../types';

type CadMetaLike = {
  volume?: number;
  surfaceArea?: number;
  triangleCount?: number;
  dimensions?: { width?: number; height?: number; depth?: number };
};

export const UploadPanel = ({ status, hasProcess, isDragging, isUploading, uploadItems, fileConfigurations, request, thumbnails, thumbFailed, activeThumbIds, onBrowse, onFiles, onDragState, onDelete, onPreview, onClearAll, t }: {
  status: PanelStatus;
  hasProcess: boolean;
  isDragging: boolean;
  isUploading: boolean;
  uploadItems: UploadItem[];
  fileConfigurations: Record<string, FileConfiguration>;
  request: RequestState;
  thumbnails: Record<string, string>;
  thumbFailed: Record<string, true>;
  activeThumbIds: string[];
  onBrowse: () => void;
  onFiles: (files: File[]) => void;
  onDragState: (d: boolean) => void;
  onDelete: (i: UploadItem) => void;
  onPreview: (f: CadFile) => void;
  onClearAll: () => void;
  t: any;
}) => {
  const disabled = !hasProcess || isUploading;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const thumbFor = (item: UploadItem) => {
    const capturable = Boolean(item.cadFile);
    const img = thumbnails[item.id];
    const generating = capturable && !thumbFailed[item.id] && activeThumbIds.includes(item.id);
    return (
      <span className="mw-file-thumb">
        {img ? (
          <img className="mw-file-thumb-img" src={img} alt={`CAD model thumbnail for ${item.name}`} />
        ) : generating ? (
          <span className="mw-file-thumb-loader" aria-hidden="true" />
        ) : (
          <span aria-hidden="true"><Icon name="file" size={14} /></span>
        )}
      </span>
    );
  };

  const manufacturingLabel = (item: UploadItem): string | null => {
    const cfg: { process?: string | null; material?: string | null } = item.cadFile ? fileConfigurations[item.cadFile.id] || {} : {};
    const material = cfg.material || request.material;
    const processId = (cfg.process || request.process) as ProcessId | null;
    const processTitle = processId ? PROCESS_INFO[processId]?.title.replace(' Printing', '') || '' : '';
    const materialLabel = material ? t(`request.material.${material}`) : '';
    const parts = [processTitle, materialLabel].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  };

  const detailsFor = (item: UploadItem) => {
    if (item.status === 'uploading') {
      return (
        <div className="mw-file-progress">
          <div className="mw-file-progress-track"><div className="mw-file-progress-bar" style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }} /></div>
          <span className="mw-file-progress-label">{item.progress}% uploaded</span>
        </div>
      );
    }
    if (item.status === 'scanning' || item.status === 'processing') {
      return <span className="mw-file-detail-text">Processing this file — validating geometry and extracting metadata…</span>;
    }
    if (item.status === 'failed' || item.status === 'unsupported') {
      return <span className="mw-file-detail-text is-alert">{item.message || item.status}</span>;
    }
    if ((item.cadFile?.latestVersion?.processingStatus || '').toLowerCase().includes('fail') && item.cadFile?.latestVersion?.failureMessage) {
      return <span className="mw-file-detail-text is-alert">{item.cadFile.latestVersion.failureMessage}</span>;
    }
    const md = item.cadFile?.latestVersion?.metadata as CadMetaLike | null | undefined;
    const parts: string[] = [];
    if (typeof md?.volume === 'number' && md.volume > 0) parts.push(`${md.volume.toFixed(2)} cm³`);
    if (typeof md?.surfaceArea === 'number' && md.surfaceArea > 0) parts.push(`${md.surfaceArea.toFixed(2)} cm²`);
    if (typeof md?.triangleCount === 'number' && md.triangleCount > 0) parts.push(`${md.triangleCount.toLocaleString()} triangles`);
    if (md?.dimensions && typeof md.dimensions.width === 'number' && typeof md.dimensions.depth === 'number' && typeof md.dimensions.height === 'number') {
      const fmt = (n: number) => (Number.isInteger(n) || Math.abs(n) >= 10 ? n.toFixed(1).replace(/\.0$/, '') : n.toFixed(2).replace(/0$/, ''));
      parts.push(`${fmt(md.dimensions.width)} × ${fmt(md.dimensions.depth)} × ${fmt(md.dimensions.height)}`);
    }
    return parts.length ? <span className="mw-file-detail-text">{parts.join(' · ')}</span> : <span className="mw-file-detail-text">Processed and validated.</span>;
  };

  return (
    <PanelShell
      id={panelIds.upload}
      icon="upload"
      title="Upload Design"
      subtitle="Drag & drop or click to browse"
      status={status}
      hideStateMark
      className="mw-panel-upload"
      action={
        uploadItems.length > 0 ? (
          <button type="button" className="mw-clear-btn" onClick={onClearAll}>
            <Icon name="trash" size={11} /> Clear All
          </button>
        ) : undefined
      }
    >
      <div className="mw-stage-upload-grid">
        <div
          className={`mw-stage-upload-zone ${isDragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
          role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
          onClick={() => { if (!disabled) onBrowse(); }}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); onBrowse(); } }}
          onDragEnter={(e: DragEvent) => { e.preventDefault(); onDragState(true); }}
          onDragOver={(e: DragEvent) => { e.preventDefault(); onDragState(true); }}
          onDragLeave={(e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDragState(false); }}
          onDrop={(e: DragEvent) => { e.preventDefault(); onDragState(false); if (!disabled) onFiles(Array.from(e.dataTransfer.files)); }}
        >
          <div className="mw-stage-upload-folder" aria-hidden="true">
            <Icon name="folder" size={46} className="mw-stage-upload-folder-layer is-back" />
            <Icon name="folder" size={46} className="mw-stage-upload-folder-layer is-mid" />
            <Icon name="folder" size={46} className="mw-stage-upload-folder-main" />
          </div>
          <span className="mw-stage-upload-text">
            {disabled ? (hasProcess ? 'Processing uploads…' : 'Select your manufacturing technology and process first.') : isDragging ? 'Drop files here' : 'Drop your CAD files here'}
          </span>
          {!disabled && <span className="mw-stage-upload-or">or click to browse</span>}
          <span className="mw-stage-upload-hint">Supports formats: STEP, STL, OBJ, IGES, and more (max 500MB per file)</span>
        </div>

        <div className="mw-stage-upload-list">
          {uploadItems.length > 0 ? (
            <>
              <div className="mw-upload-list-head">
                <span className="mw-upload-list-title">Uploaded Files</span>
                <span className="mw-upload-list-count">{uploadItems.length}</span>
              </div>
              <div className="mw-stage-file-list">
                <AnimatePresence initial={false}>
                  {uploadItems.map((item) => (
                    <motion.div
                      key={item.id}
                      className="mw-file-row cam-motion"
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: -6 }}
                      transition={{ duration: 0.2, ease: CAM_EASE }}
                    >
                      <button
                        type="button"
                        className={`mw-file-expand ${expandedId === item.id ? 'is-open' : ''}`}
                        aria-expanded={expandedId === item.id}
                        aria-label={(expandedId === item.id ? 'Collapse' : 'Expand') + ' details for ' + item.name}
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        <Icon name="chevronRight" size={11} />
                      </button>
                      {thumbFor(item)}
                      <div className="mw-file-info">
                        <div className="mw-file-name" title={item.name}>{item.name}</div>
                        <div className="mw-file-meta">
                          {item.format} · {item.size}
                          <AddManufacturing label={manufacturingLabel(item)} />
                        </div>
                      </div>
                      <div className="mw-file-actions">
                        {isUploadItemReady(item) || isUploadItemThumbnailReady(item) ? (
                          <span className="mw-file-badge is-ready"><Icon name="check" size={10} /> Ready</span>
                        ) : (
                          <span className="mw-file-badge">{item.status}</span>
                        )}
                        {(isUploadItemReady(item) || isUploadItemThumbnailReady(item)) && item.cadFile && (
                          <button type="button" className="mw-text-btn" onClick={() => onPreview(item.cadFile!)}>
                            <Icon name="eye" size={11} /> Preview
                          </button>
                        )}
                        <button
                          type="button"
                          className="mw-file-delete-btn"
                          aria-label={`Delete ${item.name}`}
                          title="Delete file"
                          onClick={() => onDelete(item)}
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                      <AnimatePresence initial={false}>
                        {expandedId === item.id && (
                          <motion.div
                            className="mw-file-details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: CAM_EASE }}
                          >
                            <div className="mw-file-details-inner">{detailsFor(item)}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="mw-upload-empty">
              <span className="mw-upload-empty-icon" aria-hidden="true"><Icon name="file" size={16} /></span>
              <span className="mw-upload-empty-text">No files yet</span>
              <span className="mw-upload-empty-hint">Drop or browse to add CAD designs.</span>
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
};

const AddManufacturing = ({ label }: { label: string | null }) => (label ? <> · {label}</> : null);