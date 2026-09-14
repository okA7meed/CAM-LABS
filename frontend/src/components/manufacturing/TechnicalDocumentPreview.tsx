import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ApiService } from '../../services/api';
import { Icon } from '../ui/Icon';
import { CAM_EASE } from '../ui/AnimatedModal';

interface TechnicalDocumentItem {
  key: string;
  id?: string;
  name: string;
  mimeType?: string;
  byteSize?: number;
  progress: number;
  status: 'uploading' | 'ready' | 'error';
  message?: string;
}

type PreviewKind = 'pdf' | 'image' | 'text' | 'unsupported';
type PreviewStatus = 'loading' | 'ready' | 'error' | 'unavailable';

const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes < 1) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const kindFor = (name: string): PreviewKind => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'image';
  if (ext === 'txt') return 'text';
  return 'unsupported';
};

/**
 * Large fullscreen-style Technical File Preview.
 *
 * Mirrors the existing 3D fullscreen viewer's presentation and infrastructure
 * (dark blurred overlay portalled to the app root, near-viewport inset panel,
 * top-right X close, Escape support) so documents read at the same visual
 * scale as the 3D Model Viewer. The file itself is loaded on demand from the
 * existing protected download endpoint; nothing is preloaded or duplicated.
 */
export const TechnicalDocumentPreview = ({ doc, onClose }: { doc: TechnicalDocumentItem; onClose: () => void }) => {
  const kind = useMemo(() => kindFor(doc.name), [doc.name]);
  const [status, setStatus] = useState<PreviewStatus>(kind === 'unsupported' ? 'unavailable' : 'loading');
  const [textContent, setTextContent] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  const downloadUrl = ApiService.getTechnicalDocumentDownloadUrl(doc.id ?? '');

  useEffect(() => {
    if (!doc.id) {
      setStatus('error');
      return;
    }
    if (kind === 'unsupported') {
      setStatus('unavailable');
      return;
    }
    if (kind === 'text') {
      let cancelled = false;
      fetch(downloadUrl, { credentials: 'same-origin' })
        .then((res) => {
          if (!res.ok) throw new Error(`failed ${res.status}`);
          return res.text();
        })
        .then((text) => {
          if (!cancelled) {
            setTextContent(text);
            setStatus('ready');
          }
        })
        .catch(() => {
          if (!cancelled) setStatus('error');
        });
      return () => {
        cancelled = true;
      };
    }
  }, [doc.id, kind, downloadUrl]);

  useEffect(() => {
    if (kind === 'pdf' && status === 'loading') {
      const timer = setTimeout(() => setStatus('error'), 12000);
      return () => clearTimeout(timer);
    }
  }, [kind, status]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const metaText = [doc.mimeType?.split('/').pop()?.toUpperCase() || (doc.name.split('.').pop() || '').toUpperCase(), formatBytes(doc.byteSize)].filter(Boolean).join(' · ');

  return createPortal(
    <motion.div
      className="mw-doc-preview-overlay cam-motion"
      role="dialog"
      aria-modal="true"
      aria-label={`Technical Document Preview: ${doc.name}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: CAM_EASE }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="mw-doc-preview-viewer cam-motion"
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.985, y: 8 }}
        transition={{ duration: 0.22, ease: CAM_EASE }}
      >
        <div className="mw-doc-preview-header">
          <div className="mw-doc-preview-title">
            <span className="mw-doc-preview-filename" title={doc.name}>{doc.name}</span>
            {metaText && <span className="mw-doc-preview-meta">{metaText}</span>}
          </div>
          <button ref={closeRef} type="button" className="mw-doc-preview-close" onClick={onClose} aria-label="Close preview" title="Close preview"><Icon name="close" size={20} /></button>
        </div>
        <div className="mw-doc-preview-body">
          {status === 'loading' && (
            <div className="mw-doc-preview-state mw-doc-preview-loading">
              <Icon name="loader" size={26} />
              <span>Loading document…</span>
            </div>
          )}
          {status === 'error' && (
            <div className="mw-doc-preview-state mw-doc-preview-error">
              <Icon name="alert" size={26} />
              <span>Unable to preview this document.</span>
            </div>
          )}
          {status === 'unavailable' && (
            <div className="mw-doc-preview-state mw-doc-preview-unavailable">
              <Icon name="file" size={26} />
              <span>Preview is not available for this file type.</span>
            </div>
          )}
          {kind === 'pdf' && status !== 'error' && status !== 'unavailable' && (
            <iframe
              className="mw-doc-preview-frame"
              src={downloadUrl}
              title={`Preview of ${doc.name}`}
              onLoad={() => setStatus('ready')}
            />
          )}
          {kind === 'image' && status !== 'error' && status !== 'unavailable' && (
            <img
              className="mw-doc-preview-img"
              src={downloadUrl}
              alt={`Preview of ${doc.name}`}
              onLoad={() => setStatus('ready')}
              onError={() => setStatus('error')}
            />
          )}
          {status === 'ready' && kind === 'text' && (
            <pre className="mw-doc-preview-text">{textContent}</pre>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.getElementById('root') ?? document.body
  );
};