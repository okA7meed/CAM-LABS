import React, { useEffect, useRef } from 'react';
import { CadFile } from '../../../types';
import { ApiService } from '../../../services/api';
import { CadGeometryViewer } from '../../manufacturing/CadGeometryViewer';
import { AnimatedModal } from '../../ui/AnimatedModal';
import { Icon } from '../../ui/Icon';

/**
 * Real interactive 3D preview: loads the actual uploaded CAD file through the
 * existing CadGeometryViewer (orbit / zoom / pan / fit-to-view). Full geometry
 * is only fetched when the dialog opens — the page itself renders lightweight
 * static thumbnails. Resources dispose with the viewer on unmount.
 */
export const CadViewerDialog: React.FC<{
  files: CadFile[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onDownload: (file: CadFile) => void;
}> = ({ files, activeId, onSelect, onClose, onDownload }) => {
  const open = activeId !== null;
  const active = files.find((f) => f.id === activeId) || null;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatedModal
      open={open}
      cardClassName="modal-lg"
      role="dialog"
      ariaLabel={active ? `3D preview of ${active.name}` : '3D preview'}
      onOverlayMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <div className="od-viewer-head">
          <span className="od-viewer-icon" aria-hidden="true">
            <Icon name="cube" size={16} />
          </span>
          <div className="od-viewer-titles">
            <h3 className="modal-title" title={active?.name || ''}>
              {active?.name || '3D Preview'}
            </h3>
            <p className="od-viewer-sub">
              {(active?.format || '').toUpperCase()} · {active?.size || ''} · drag to rotate · scroll to zoom · right-drag to pan
            </p>
          </div>
        </div>
        <div className="od-viewer-actions">
          {active && (
            <a
              className="btn btn-outline btn-sm"
              href={ApiService.getCadDownloadUrl(active.id)}
              download={active.name}
              title={`Download ${active.name}`}
            >
              <Icon name="download" size={13} />
              Download
            </a>
          )}
          <button ref={closeRef} type="button" className="btn btn-outline btn-sm" onClick={onClose} aria-label="Close 3D preview">
            <Icon name="close" size={13} />
            Close
          </button>
        </div>
      </div>
      <div className="modal-body">
        {files.length > 1 && (
          <div className="od-viewer-tabs" role="tablist" aria-label="CAD files">
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                role="tab"
                aria-selected={file.id === activeId}
                className={`od-viewer-tab${file.id === activeId ? ' is-active' : ''}`}
                onClick={() => onSelect(file.id)}
                title={file.name}
              >
                {file.name.length > 26 ? `${file.name.slice(0, 25)}…` : file.name}
              </button>
            ))}
          </div>
        )}
        <div className="od-viewer-canvas">
          {active && (
            <CadGeometryViewer
              key={active.id}
              file={active}
              onGeometry={() => undefined}
            />
          )}
        </div>
        {active && (
          <div className="od-viewer-foot">
            <span className="admin-muted">{active.dimensions || ''}</span>
            <button type="button" className="od-link" onClick={() => onDownload(active)}>
              Download original file
            </button>
          </div>
        )}
      </div>
    </AnimatedModal>
  );
};
