import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { CadFile, Quote } from '../../types';
import { ApiService, CadGeometryData } from '../../services/api';
import { Icon, IconName } from '../ui/Icon';
import { AnimatedModal } from '../ui/AnimatedModal';
import { CadGeometryViewer } from '../manufacturing/CadGeometryViewer';
import { generateQuotePdf } from '../admin/quote-detail/pdf';
import {
  QuoteFileVM,
  businessReferenceOf,
  parseEgpAmount,
  quotePricingOf,
  shippingInfoOf,
  summarizeSpec,
} from '../admin/quote-detail/types';
import { expiryInfoOf, formatQuoteDateTime } from '../admin/quote-detail/format';
import {
  fileExtension,
  formatShortDate,
  hasPendingDeletionRequest,
  isQuoteDeletable,
  quoteBadgeTone,
} from './dashUtils';
import {
  WorkspaceFile,
  fileLineTotal,
  joinFullAddress,
  quoteTimelineOf,
  resolveWorkspaceFiles,
  selectedFileSpecs,
} from './quoteWorkspaceUtils';
import { useDashboardThumbnails } from './useDashboardThumbnails';
import { useQuoteDelete } from './useQuoteDelete';
import { QuoteDeleteDialog } from './QuoteDeleteDialog';

/**
 * Customer Quote Review Workspace (read-only, real data only). Shared by the
 * Dashboard Recent Quotes rows and the My Quotes list — same signature as
 * before ({ quote, onClose }) plus an optional onDeleted hook.
 *
 * Data: GET /quotes/:id (full row: pricingBreakdown, snapshots, audit
 * fields) + GET /cad-files (catalog to resolve cadFileIds). No backend
 * change, no N+1 (one catalog request, geometry streams through the shared
 * cadGeometryCache; a single live viewer + lightweight thumbnails).
 *
 * Business rules preserved: no file mutation (no customer endpoint exists —
 * Add Files is disabled with reason), no delivery editing (snapshots are
 * immutable post-submit), delete only via existing eligibility + dialog.
 */

type FetchState = 'loading' | 'ready' | 'error';

const FLAT_FORMATS = ['DXF', 'SVG', 'PDF'];

const copyReferenceText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
};

const SummaryRow: React.FC<{ icon: IconName; label: string; children: React.ReactNode; ltr?: boolean }> = ({
  icon,
  label,
  children,
  ltr,
}) => (
  <div className="qw-summary-row">
    <span className="qw-summary-label">
      <Icon name={icon} size={15} />
      {label}
    </span>
    <span className="qw-summary-value" dir={ltr ? 'ltr' : undefined}>
      {children}
    </span>
  </div>
);

const SpecCell: React.FC<{ icon: string; label: string; value: string; ltr?: boolean }> = ({ icon, label, value, ltr }) => (
  <div className="qw-spec">
    <span className="qw-spec-icon" aria-hidden="true">
      <Icon name={icon as IconName} size={16} />
    </span>
    <span className="qw-spec-text">
      <span className="qw-spec-label">{label}</span>
      <span className="qw-spec-value" dir={ltr ? 'ltr' : undefined}>
        {value}
      </span>
    </span>
  </div>
);

export const QuoteDetailModal: React.FC<{ quote: Quote | null; onClose: () => void; onDeleted?: (id: string) => void }> = ({
  quote,
  onClose,
  onDeleted,
}) => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useStore();

  const [full, setFull] = useState<Quote | null>(null);
  const [cadById, setCadById] = useState<Map<string, CadFile>>(new Map());
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dimsByFile, setDimsByFile] = useState<Record<string, { width: number; height: number; depth: number }>>({});
  const [viewKey, setViewKey] = useState(0);
  const [fitSignal, setFitSignal] = useState(0);
  const [dollySignal, setDollySignal] = useState<{ dir: 1 | -1; nonce: number } | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const restoreFocusRef = useRef<Element | null>(null);

  const quoteId = quote?.id || null;

  const load = useCallback(async () => {
    if (!quoteId) return;
    setFetchState('loading');
    try {
      const [detail, catalog] = await Promise.all([
        ApiService.getQuoteById(quoteId).catch(() => null),
        ApiService.getCadFiles().catch(() => null),
      ]);
      if (!detail) {
        setFetchState('error');
        return;
      }
      setFull(detail as Quote);
      const map = new Map<string, CadFile>();
      for (const file of catalog || []) {
        if (file?.id) map.set(file.id, file);
      }
      setCadById(map);
      setFetchState('ready');
    } catch {
      setFetchState('error');
    }
  }, [quoteId]);

  // Fresh state per opened quote; focus + body-scroll management.
  useEffect(() => {
    if (!quote) return;
    restoreFocusRef.current = document.activeElement;
    setFull(null);
    setCadById(new Map());
    setSelectedId(null);
    setDimsByFile({});
    setViewKey(0);
    setFitSignal(0);
    setDollySignal(null);
    setPanMode(false);
    setWireframe(false);
    setCopied(false);
    void load();
  }, [quoteId, quote, load]);

  useEffect(() => {
    if (!quote) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // The 3D viewer owns Escape while fullscreen; don't close under it.
      if (document.querySelector('.geometry-canvas-panel.is-fullscreen')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      restoreFocusRef.current instanceof HTMLElement && restoreFocusRef.current.focus?.();
    };
  }, [quote, onClose]);

  const record: Quote | null = full || quote;
  const files: WorkspaceFile[] = useMemo(
    () => (record ? resolveWorkspaceFiles(record, cadById) : []),
    [record, cadById],
  );
  const selected: WorkspaceFile | null = useMemo(() => {
    if (files.length === 0) return null;
    return files.find((f) => f.fileId === selectedId) || files[0];
  }, [files, selectedId]);

  const catalogFiles = useMemo(() => files.map((f) => f.cad).filter((c): c is CadFile => c !== null), [files]);
  const thumbs = useDashboardThumbnails(catalogFiles);

  const reference = useMemo(() => businessReferenceOf(record as unknown as Record<string, unknown>), [record]);
  const pricing = useMemo(() => (record ? quotePricingOf(record as unknown as Record<string, unknown>) : null), [record]);
  const shipping = useMemo(() => (record ? shippingInfoOf(record as unknown as Record<string, unknown>) : null), [record]);
  const expiry = useMemo(() => expiryInfoOf(typeof record?.validUntil === 'string' ? record.validUntil : null), [record]);
  const timeline = useMemo(() => (record ? quoteTimelineOf(record) : []), [record]);
  const technologySummary = useMemo(() => {
    if (!record) return null;
    const fromFiles = summarizeSpec(files.map((f) => f.vm?.process || ''));
    if (fromFiles !== '—') return fromFiles;
    return (record.technology || '').trim() || null;
  }, [files, record]);

  const headlineTotal = useMemo(() => {
    if (!record) return '—';
    if (pricing && pricing.storedEstimated !== null) return `${pricing.storedEstimated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
    return record.totalPrice || '—';
  }, [record, pricing]);

  const handleGeometry = useCallback((fileId: string, geometry: CadGeometryData) => {
    const dims = geometry.metadata?.dimensions;
    if (dims && Number.isFinite(dims.width) && Number.isFinite(dims.height) && Number.isFinite(dims.depth)) {
      setDimsByFile((prev) =>
        prev[fileId] ? prev : { ...prev, [fileId]: { width: dims.width, height: dims.height, depth: dims.depth } },
      );
    }
  }, []);

  const copyReference = useCallback(async () => {
    const ok = await copyReferenceText(reference);
    setCopied(ok);
    showToast(ok ? t('quotedetail.copied') : t('quotedetail.copyFailed'), reference, ok ? 'success' : 'error');
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  }, [reference, showToast, t]);

  const pdfFiles: QuoteFileVM[] = useMemo(
    () =>
      files.map((f) => ({
        fileId: f.fileId,
        fileName: f.name,
        quantity: f.vm?.quantity ?? record?.quantity ?? 1,
        material: f.vm?.material && f.vm.material !== '—' ? f.vm.material : record?.material || '—',
        process: f.vm?.process && f.vm.process !== '—' ? f.vm.process : record?.technology || '—',
        perUnitCost: f.vm?.perUnitCost ?? null,
        pricingBreakdown: (f.vm?.pricingBreakdown || {}) as Record<string, unknown>,
      })),
    [files, record],
  );

  const downloadPdf = useCallback(() => {
    if (!record || pdfBusy) return;
    setPdfBusy(true);
    try {
      const opened = generateQuotePdf(
        record as unknown as Record<string, unknown>,
        pdfFiles,
        record.contactName?.trim() || currentUser?.name || 'Customer',
      );
      if (!opened) showToast(t('quotedetail.pdfBlockedTitle'), t('quotedetail.pdfBlockedBody'), 'error');
    } catch (err) {
      showToast(t('quotedetail.pdfErrorTitle'), err instanceof Error ? err.message : t('quotedetail.pdfErrorBody'), 'error');
    } finally {
      window.setTimeout(() => setPdfBusy(false), 600);
    }
  }, [record, pdfFiles, currentUser?.name, pdfBusy, showToast, t]);

  const handleDeleted = useCallback(
    (id: string) => {
      onDeleted?.(id);
      onClose();
    },
    [onDeleted, onClose],
  );
  const quoteDelete = useQuoteDelete(handleDeleted);
  const deletable = record ? isQuoteDeletable(record) : false;
  const deletionPending = record ? hasPendingDeletionRequest(record) : false;

  const specs = useMemo(
    () => (selected && record ? selectedFileSpecs(selected, record, dimsByFile[selected.fileId] || null) : []),
    [selected, record, dimsByFile],
  );
  const lineTotal = useMemo(() => fileLineTotal(selected?.vm || null), [selected]);
  const headerUnitFallback = useMemo(() => {
    if (!record || specs.some((s) => s.key === 'unit')) return null;
    const n = parseEgpAmount(record.unitPrice);
    return n === null ? null : `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
  }, [record, specs]);

  const selectedExt = fileExtension(selected?.cad?.name || selected?.name);
  const isFlatFormat = selected?.cad ? FLAT_FORMATS.includes((selected.cad.format || '').toUpperCase()) : false;
  const deliveryAddress = record ? joinFullAddress(record) : null;
  const recipient = record?.contactName?.trim() || currentUser?.name || null;
  const validUntilLabel = record
    ? `${formatShortDate(record.validUntil, i18n.language)}${expiry.daysLeft !== null && !expiry.expired ? ` (${t('quotedetail.daysLeft', { count: expiry.daysLeft })})` : ''}`
    : '—';

  return (
    <AnimatedModal open={quote !== null} role="dialog" ariaLabel={t('quotedetail.title')} cardClassName="qw-shell qw-shell--quote">
      {quote && record && (
        <div className="qw-workspace">
          {/* ── Header ── */}
          <header className="qw-head">
            <span className="qw-head-icon" aria-hidden="true">
              <Icon name="cube" size={26} />
            </span>
            <div className="qw-head-titles">
              <h2>{t('quotedetail.title')}</h2>
              <p>{t('quotedetail.subtitle')}</p>
            </div>
            <div className="qw-head-meta">
              <span className="qw-quote-id-label">{t('quotedetail.quoteId')}</span>
              <span className="qw-quote-id" dir="ltr">
                {reference}
                <button
                  type="button"
                  className="qw-copy-btn"
                  onClick={() => void copyReference()}
                  title={t('quotedetail.copyRef')}
                  aria-label={`${t('quotedetail.copyRef')}: ${reference}`}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={14} />
                </button>
              </span>
              <span className="qw-head-sub">
                  <span className={`dash-badge is-${quoteBadgeTone(record.status)}`}>
                    <span className="dash-badge-dot" aria-hidden="true" />
                    {record.status}
                  </span>
                  {deletionPending && (
                    <span className="dash-badge is-amber dash-pending-badge">
                      <span className="dash-badge-dot" aria-hidden="true" />
                      {t('dashboard.deletionRequested')}
                    </span>
                  )}
                <span className="qw-created">
                  {t('quotedetail.createdOn')} {formatQuoteDateTime(record.createdAt || undefined)}
                </span>
              </span>
            </div>
            <button type="button" className="qw-close-x" onClick={onClose} aria-label={t('dashboard.close')}>
              <Icon name="close" size={18} />
            </button>
          </header>

          {fetchState === 'loading' && (
            <div className="qw-loading" role="status" aria-label={t('dashboard.loading')}>
              <span className="skeleton qw-skeleton" />
              <span className="skeleton qw-skeleton" />
            </div>
          )}

          {fetchState === 'error' && (
            <div className="qw-state" role="alert">
              <strong>{t('quotedetail.loadFailed')}</strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
                {t('dashboard.retry')}
              </button>
            </div>
          )}

          {fetchState !== 'loading' && (
            <>
              {/* ── Upper grid: Files | Viewer | Summary ── */}
              <div className="qw-upper">
                <section className="qw-files" aria-labelledby="qw-files-title">
                  <header className="qw-files-head">
                    <h3 id="qw-files-title">
                      {t('quotedetail.files')} ({files.length})
                    </h3>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm qw-add-files"
                      disabled
                      title={t('quotedetail.addFilesDisabled')}
                      aria-disabled="true"
                    >
                      <Icon name="plus" size={14} />
                      {t('quotedetail.addFiles')}
                    </button>
                  </header>
                  {files.length === 0 ? (
                    <p className="qw-empty">{t('quotedetail.filesEmpty')}</p>
                  ) : (
                    <ul className="qw-file-list">
                      {files.map((f) => {
                        const active = selected?.fileId === f.fileId;
                        const qty = f.vm?.quantity ?? record.quantity;
                        const ext = fileExtension(f.cad?.name || f.name);
                        const thumb = f.cad ? thumbs[f.cad.id] : undefined;
                        return (
                          <li key={f.fileId}>
                            <button
                              type="button"
                              className={`qw-file${active ? ' is-active' : ''}`}
                              aria-pressed={active}
                              onClick={() => {
                                setSelectedId(f.fileId);
                                setViewKey((k) => k + 1);
                              }}
                            >
                              <span className="qw-file-thumb" aria-hidden="true">
                                {thumb?.url ? (
                                  <img src={thumb.url} alt="" draggable={false} loading="lazy" />
                                ) : (
                                  <span className="qw-file-thumb-fallback">
                                    <Icon name="cube" size={20} />
                                    {ext && (
                                      <span className="qw-file-thumb-ext" dir="ltr">
                                        {ext}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </span>
                              <span className="qw-file-text">
                                <span className="qw-file-name" dir="ltr">
                                  {f.name}
                                </span>
                                <span className="qw-file-meta" dir="ltr">
                                  {ext || t('quotedetail.fileUnknownType')} · {qty} pcs
                                </span>
                              </span>
                              <Icon name="chevronRight" size={15} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="qw-viewer" aria-label={t('quotedetail.viewerLabel')}>
                  <header className="qw-viewer-head">
                    <div className="qw-viewer-title">
                      <strong dir="ltr">{selected?.name || t('quotedetail.viewerEmpty')}</strong>
                      {selectedExt && (
                        <span className="qw-ext-badge" dir="ltr">
                          {selectedExt} {t('quotedetail.fileSuffix')}
                        </span>
                      )}
                    </div>
                    <div className="qw-viewer-tools" role="toolbar" aria-label={t('quotedetail.viewerTools')}>
                      <button
                        type="button"
                        className="qw-tool-btn"
                        title={t('quotedetail.resetView')}
                        aria-label={t('quotedetail.resetView')}
                        disabled={!selected?.cad}
                        onClick={() => setViewKey((k) => k + 1)}
                      >
                        <Icon name="reset" size={15} />
                        <span>{t('quotedetail.resetView')}</span>
                      </button>
                      <button
                        type="button"
                        className="qw-tool-btn"
                        title={t('quotedetail.fitView')}
                        aria-label={t('quotedetail.fitView')}
                        disabled={!selected?.cad}
                        onClick={() => setFitSignal((n) => n + 1)}
                      >
                        <Icon name="expand" size={15} />
                        <span>{t('quotedetail.fitView')}</span>
                      </button>
                      <button
                        type="button"
                        className="qw-tool-btn"
                        title={t('quotedetail.zoomIn')}
                        aria-label={t('quotedetail.zoomIn')}
                        disabled={!selected?.cad}
                        onClick={() => setDollySignal({ dir: 1, nonce: Date.now() })}
                      >
                        <Icon name="plus" size={15} />
                        <span>{t('quotedetail.zoomIn')}</span>
                      </button>
                      <button
                        type="button"
                        className="qw-tool-btn"
                        title={t('quotedetail.zoomOut')}
                        aria-label={t('quotedetail.zoomOut')}
                        disabled={!selected?.cad}
                        onClick={() => setDollySignal({ dir: -1, nonce: Date.now() })}
                      >
                        <span className="qw-minus" aria-hidden="true">
                          −
                        </span>
                        <span>{t('quotedetail.zoomOut')}</span>
                      </button>
                      <span className="qw-mode-toggle" role="group" aria-label={t('quotedetail.interactionMode')}>
                        <button
                          type="button"
                          className={!panMode ? 'is-active' : ''}
                          aria-pressed={!panMode}
                          disabled={!selected?.cad}
                          onClick={() => setPanMode(false)}
                        >
                          {t('quotedetail.modeRotate')}
                        </button>
                        <button
                          type="button"
                          className={panMode ? 'is-active' : ''}
                          aria-pressed={panMode}
                          disabled={!selected?.cad}
                          onClick={() => setPanMode(true)}
                        >
                          {t('quotedetail.modePan')}
                        </button>
                      </span>
                    </div>
                  </header>
                  <div className="qw-canvas">
                    {selected?.cad ? (
                      <CadGeometryViewer
                        key={`${selected.cad.id}:${viewKey}`}
                        file={selected.cad}
                        thumbnail={false}
                        wireframe={wireframe}
                        fitSignal={fitSignal}
                        dollySignal={dollySignal}
                        panMode={panMode}
                        onGeometry={(g) => handleGeometry(selected.cad!.id, g)}
                      />
                    ) : (
                      <div className="qw-canvas-empty" role="status">
                        <Icon name="cube" size={30} />
                        <p>{t(selected ? 'quotedetail.fileUnavailable' : 'quotedetail.viewerEmpty')}</p>
                      </div>
                    )}
                    {selected?.cad && !isFlatFormat && (
                      <div className="qw-view-toggle" role="group" aria-label={t('quotedetail.viewMode')}>
                        <button
                          type="button"
                          className={!wireframe ? 'is-active' : ''}
                          aria-pressed={!wireframe}
                          onClick={() => setWireframe(false)}
                        >
                          {t('quotedetail.view3d')}
                        </button>
                        <button
                          type="button"
                          className={wireframe ? 'is-active' : ''}
                          aria-pressed={wireframe}
                          onClick={() => setWireframe(true)}
                        >
                          {t('quotedetail.view2d')}
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="qw-viewer-hint">{t('quotedetail.viewerHint')}</p>
                </section>

                <aside className="qw-summary" aria-labelledby="qw-summary-title">
                  <h3 id="qw-summary-title">
                    <span className="qw-summary-icon" aria-hidden="true">
                      <Icon name="file" size={16} />
                    </span>
                    {t('quotedetail.summary')}
                  </h3>
                  <SummaryRow icon="wallet" label={t('quotedetail.totalAmount')} ltr>
                    <strong className="qw-total">{headlineTotal}</strong>
                  </SummaryRow>
                  <SummaryRow icon="check" label={t('quotedetail.statusRow')}>
                    <span className={`dash-badge is-${quoteBadgeTone(record.status)}`}>
                      <span className="dash-badge-dot" aria-hidden="true" />
                      {record.status}
                    </span>
                  </SummaryRow>
                  <SummaryRow icon="calendar" label={t('quotedetail.validUntilRow')}>
                    {validUntilLabel}
                  </SummaryRow>
                  <SummaryRow icon="clock" label={t('quotedetail.createdOnRow')}>
                    {formatQuoteDateTime(record.createdAt || undefined)}
                  </SummaryRow>
                  <SummaryRow icon="truck" label={t('quotedetail.leadTimeRow')} ltr>
                    {record.leadTime || t('quotedetail.notAvailable')}
                  </SummaryRow>
                  <SummaryRow icon="file" label={t('quotedetail.filesRow')} ltr>
                    {t('quotedetail.filesCount', { count: files.length })}
                  </SummaryRow>
                  <SummaryRow icon="cpu" label={t('quotedetail.technologyRow')}>
                    {technologySummary || t('quotedetail.notAvailable')}
                  </SummaryRow>
                  <button
                    type="button"
                    className="btn btn-primary qw-pdf-btn"
                    disabled={pdfBusy}
                    onClick={downloadPdf}
                  >
                    <Icon name="download" size={15} />
                    {pdfBusy ? t('quotedetail.pdfBusy') : t('quotedetail.downloadPdf')}
                  </button>
                </aside>
              </div>

              {/* ── Selected File Details ── */}
              <section className="qw-details" aria-labelledby="qw-details-title">
                <header className="qw-details-head">
                  <span className="qw-details-icon" aria-hidden="true">
                    <Icon name="cube" size={18} />
                  </span>
                  <div>
                    <h3 id="qw-details-title">{t('quotedetail.selectedDetails')}</h3>
                    <p>{t('quotedetail.selectedDetailsSub')}</p>
                  </div>
                  {selected && (
                    <div className="qw-details-file">
                      <strong dir="ltr">{selected.name}</strong>
                      {selectedExt && (
                        <span className="qw-ext-badge" dir="ltr">
                          {selectedExt} {t('quotedetail.fileSuffix')}
                        </span>
                      )}
                    </div>
                  )}
                </header>
                {specs.length === 0 && !headerUnitFallback ? (
                  <p className="qw-empty">{t('quotedetail.specsEmpty')}</p>
                ) : (
                  <div className="qw-spec-grid">
                    {specs.map((s) => (
                      <SpecCell key={s.key} icon={s.icon} label={t(s.labelKey)} value={s.value || ''} ltr={s.ltr} />
                    ))}
                    {headerUnitFallback && <SpecCell icon="wallet" label={t('quotedetail.specUnitPrice')} value={headerUnitFallback} ltr />}
                    {lineTotal && <SpecCell icon="calculator" label={t('quotedetail.specLineTotal')} value={lineTotal} ltr />}
                  </div>
                )}
              </section>

              {/* ── Lower grid: Delivery | Notes | Timeline ── */}
              <div className="qw-lower">
                <section className="qw-card" aria-labelledby="qw-delivery-title">
                  <header className="qw-card-head">
                    <span className="qw-card-icon" aria-hidden="true">
                      <Icon name="truck" size={18} />
                    </span>
                    <div>
                      <h3 id="qw-delivery-title">{t('quotedetail.delivery')}</h3>
                      <p>{t('quotedetail.deliverySub')}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm qw-edit-btn"
                      disabled
                      title={t('quotedetail.editDisabled')}
                      aria-disabled="true"
                    >
                      <Icon name="pencil" size={13} />
                      {t('quotedetail.edit')}
                    </button>
                  </header>
                  <dl className="qw-delivery-grid">
                    <div>
                      <dt>
                        <Icon name="userRound" size={13} /> {t('quotedetail.recipient')}
                      </dt>
                      <dd>{recipient || t('quotedetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="phone" size={13} /> {t('quotedetail.phone')}
                      </dt>
                      <dd dir="ltr">{record.contactPhone?.trim() || t('quotedetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="mapPin" size={13} /> {t('quotedetail.governorate')}
                      </dt>
                      <dd>{record.governorate?.trim() || t('quotedetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="building" size={13} /> {t('quotedetail.city')}
                      </dt>
                      <dd>{record.city?.trim() || t('quotedetail.notAvailable')}</dd>
                    </div>
                    <div className="qw-span-2">
                      <dt>
                        <Icon name="mapPin" size={13} /> {t('quotedetail.fullAddress')}
                      </dt>
                      <dd>{deliveryAddress || t('quotedetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="truck" size={13} /> {t('quotedetail.method')}
                      </dt>
                      <dd>{shipping?.name && shipping.name !== '—' ? shipping.name : t('quotedetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="calendar" size={13} /> {t('quotedetail.estimated')}
                      </dt>
                      <dd>{shipping?.eta || t('quotedetail.notAvailable')}</dd>
                    </div>
                  </dl>
                </section>

                <div className="qw-notes-col">
                  <section className="qw-card" aria-labelledby="qw-cnotes-title">
                    <header className="qw-card-head">
                      <span className="qw-card-icon" aria-hidden="true">
                        <Icon name="message" size={18} />
                      </span>
                      <div>
                        <h3 id="qw-cnotes-title">{t('quotedetail.customerNotes')}</h3>
                        <p>{t('quotedetail.customerNotesSub')}</p>
                      </div>
                    </header>
                    {record.technicalNotes?.trim() ? (
                      <p className="qw-note-text">{record.technicalNotes}</p>
                    ) : (
                      <p className="qw-empty">{t('quotedetail.noCustomerNotes')}</p>
                    )}
                  </section>
                  <section className="qw-card" aria-labelledby="qw-mnotes-title">
                    <header className="qw-card-head">
                      <span className="qw-card-icon" aria-hidden="true">
                        <Icon name="gear" size={18} />
                      </span>
                      <div>
                        <h3 id="qw-mnotes-title">{t('quotedetail.mfgNotes')}</h3>
                        <p>{t('quotedetail.mfgNotesSub')}</p>
                      </div>
                    </header>
                    <p className="qw-empty">{t('quotedetail.noMfgNotes')}</p>
                  </section>
                </div>

                <section className="qw-card" aria-labelledby="qw-timeline-title">
                  <header className="qw-card-head">
                    <span className="qw-card-icon" aria-hidden="true">
                      <Icon name="clock" size={18} />
                    </span>
                    <div>
                      <h3 id="qw-timeline-title">{t('quotedetail.timeline')}</h3>
                      <p>{t('quotedetail.timelineSub')}</p>
                    </div>
                  </header>
                  <ol className="qw-timeline">
                    {timeline.map((node) => (
                      <li key={node.key} className={`qw-tl-node is-${node.state}`}>
                        <span className="qw-tl-marker" aria-hidden="true">
                          {(node.state === 'done' || node.state === 'error') && <Icon name={node.state === 'error' ? 'close' : 'check'} size={11} />}
                        </span>
                        <span className="qw-tl-text">
                          <strong>{t(node.labelKey)}</strong>
                          <span className="qw-tl-time" dir="ltr">
                            {node.at ? formatQuoteDateTime(node.at) : t('quotedetail.timelineNoTime')}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              {/* ── Footer ── */}
              <footer className="qw-foot">
                {deletionPending ? (
                  <span className="dash-badge is-amber dash-pending-badge">
                    <span className="dash-badge-dot" aria-hidden="true" />
                    {t('dashboard.deletionRequested')}
                  </span>
                ) : deletable ? (
                  <button
                    type="button"
                    className="btn btn-sm account-btn-danger-ghost qw-delete-btn"
                    onClick={() => record && quoteDelete.askDelete(record)}
                  >
                    <Icon name="trash" size={15} />
                    {t('quotedetail.deleteQuote')}
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" className="btn btn-outline qw-close-btn" onClick={onClose}>
                  <Icon name="close" size={15} />
                  {t('dashboard.close')}
                </button>
              </footer>
            </>
          )}
        </div>
      )}

      <QuoteDeleteDialog
        quote={quoteDelete.target}
        reason={quoteDelete.reason}
        onReasonChange={quoteDelete.setReason}
        busy={quoteDelete.busy}
        errorMessage={quoteDelete.errorCode === 'QUOTE_PROTECTED' ? t('dashboard.deleteProtected') : quoteDelete.errorMessage}
        onCancel={quoteDelete.cancel}
        onConfirm={() => void quoteDelete.confirm()}
      />
    </AnimatedModal>
  );
};
