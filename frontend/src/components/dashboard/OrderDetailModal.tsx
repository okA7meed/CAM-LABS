import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { CadFile, Order } from '../../types';
import { ApiService, CadGeometryData } from '../../services/api';
import { Icon, IconName } from '../ui/Icon';
import { AnimatedModal } from '../ui/AnimatedModal';
import { CadGeometryViewer } from '../manufacturing/CadGeometryViewer';
import { formatShortDate, orderBadgeTone } from './dashUtils';
import {
  WorkspaceOrderFile,
  customerVisibleOrderUpdates,
  orderDeliveryInfoOf,
  orderTimelineOf,
  resolveOrderFiles,
  selectedOrderFileSpecs,
} from './orderWorkspaceUtils';
import { useDashboardThumbnails } from './useDashboardThumbnails';

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

export const OrderDetailModal: React.FC<{ order: Order | null; onClose: () => void }> = ({
  order,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useStore();

  const [full, setFull] = useState<Order | null>(null);
  const [cadById, setCadById] = useState<Map<string, CadFile>>(new Map());
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dimsByFile, setDimsByFile] = useState<Record<string, { width: number; height: number; depth: number }>>({});
  const [viewKey, setViewKey] = useState(0);
  const [fitSignal, setFitSignal] = useState(0);
  const [dollySignal, setDollySignal] = useState<{ dir: 1 | -1; nonce: number } | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [copied, setCopied] = useState(false);
  const restoreFocusRef = useRef<Element | null>(null);

  const orderId = order?.id || null;

  const load = useCallback(async () => {
    if (!orderId) return;
    setFetchState('loading');
    try {
      const [detail, catalog] = await Promise.all([
        ApiService.getOrderById(orderId).catch(() => null),
        ApiService.getCadFiles().catch(() => null),
      ]);
      if (!detail) {
        setFetchState('error');
        return;
      }
      setFull(detail);
      const map = new Map<string, CadFile>();
      for (const file of catalog || []) {
        if (file?.id) map.set(file.id, file);
      }
      setCadById(map);
      setFetchState('ready');
    } catch {
      setFetchState('error');
    }
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
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
  }, [orderId, order, load]);

  useEffect(() => {
    if (!order) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.geometry-canvas-panel.is-fullscreen')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus?.();
      }
    };
  }, [order, onClose]);

  const record: Order | null = full || order;

  const files: WorkspaceOrderFile[] = useMemo(
    () => (record ? resolveOrderFiles(record, cadById) : []),
    [record, cadById],
  );

  const selected: WorkspaceOrderFile | null = useMemo(() => {
    if (files.length === 0) return null;
    return files.find((f) => f.fileId === selectedId) || files[0];
  }, [files, selectedId]);

  const catalogFiles = useMemo(() => files.map((f) => f.cad).filter((c): c is CadFile => c !== null), [files]);
  const thumbs = useDashboardThumbnails(catalogFiles);

  const reference = record?.reference || record?.id || '';
  const delivery = useMemo(() => (record ? orderDeliveryInfoOf(record, currentUser) : null), [record, currentUser]);
  const timeline = useMemo(() => (record ? orderTimelineOf(record) : []), [record]);

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
    showToast(ok ? t('orderdetail.copied') : t('orderdetail.copyFailed'), reference, ok ? 'success' : 'error');
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  }, [reference, showToast, t]);

  const specs = useMemo(
    () => (selected && record ? selectedOrderFileSpecs(selected, record, dimsByFile[selected.fileId] || null) : []),
    [selected, record, dimsByFile],
  );

  const isFlatFormat = selected?.cad ? FLAT_FORMATS.includes((selected.cad.format || '').toUpperCase()) : false;

  // Customer-safe manufacturing updates only (see customerVisibleOrderUpdates:
  // raw event descriptions/metadata are never rendered).
  const mfgUpdates = useMemo(() => customerVisibleOrderUpdates(record?.events), [record]);

  return (
    <AnimatedModal open={order !== null} role="dialog" ariaLabel={t('orderdetail.title')} cardClassName="qw-shell qw-shell--order">
      {order && record && (
        <div className="qw-workspace">
          {/* ── Header ── */}
          <header className="qw-head">
            <span className="qw-head-icon" aria-hidden="true">
              <Icon name="cube" size={26} />
            </span>
            <div className="qw-head-titles">
              <h2>{t('orderdetail.title')}</h2>
              <p>{t('orderdetail.subtitle')}</p>
            </div>
            <div className="qw-head-meta">
              <span className="qw-quote-id-label">{t('orderdetail.orderId')}</span>
              <span className="qw-quote-id" dir="ltr">
                {reference}
                <button
                  type="button"
                  className="qw-copy-btn"
                  onClick={() => void copyReference()}
                  title={t('orderdetail.copyRef')}
                  aria-label={`${t('orderdetail.copyRef')}: ${reference}`}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={14} />
                </button>
              </span>
              <span className="qw-head-sub">
                <span className={`dash-badge is-${orderBadgeTone(record.status)}`}>
                  <span className="dash-badge-dot" aria-hidden="true" />
                  {record.status}
                </span>
                <span className="qw-created">
                  {t('orderdetail.createdOn')} {formatShortDate(record.createdAt || record.date, i18n.language)}
                </span>
              </span>
            </div>
            <button type="button" className="qw-close-x" onClick={onClose} aria-label={t('common.close', { defaultValue: 'Close' })}>
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
              <strong>{t('orderdetail.loadFailed')}</strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
                {t('dashboard.retry')}
              </button>
            </div>
          )}

          {fetchState !== 'loading' && (
            <>
              {/* ── Upper grid: Files | Viewer | Summary ── */}
              <div className="qw-upper">
                {/* Files Panel */}
                <section className="qw-files" aria-labelledby="order-files-title">
                  <header className="qw-files-head">
                    <h3 id="order-files-title">
                      {t('orderdetail.files')} ({files.length})
                    </h3>
                  </header>
                  {files.length === 0 ? (
                    <p className="qw-empty">{t('orderdetail.filesEmpty')}</p>
                  ) : (
                    <ul className="qw-file-list">
                      {files.map((f) => {
                        const active = selected?.fileId === f.fileId;
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
                                    {f.format && (
                                      <span className="qw-file-thumb-ext" dir="ltr">
                                        {f.format}
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
                                  {f.format} · {f.quantity} pcs
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

                {/* 3D Viewer */}
                <section className="qw-viewer" aria-label={t('quotedetail.viewerLabel')}>
                  <header className="qw-viewer-head">
                    <div className="qw-viewer-title">
                      <strong dir="ltr">{selected?.name || t('quotedetail.viewerEmpty')}</strong>
                      {selected?.format && (
                        <span className="qw-ext-badge" dir="ltr">
                          {selected.format}
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

                {/* Order Summary Card */}
                <aside className="qw-summary" aria-labelledby="order-summary-title">
                  <h3 id="order-summary-title">
                    <span className="qw-summary-icon" aria-hidden="true">
                      <Icon name="cube" size={16} />
                    </span>
                    {t('orderdetail.summary')}
                  </h3>
                  <SummaryRow icon="wallet" label={t('orderdetail.totalAmount')} ltr>
                    <strong className="qw-total">{record.totalCost}</strong>
                  </SummaryRow>
                  <SummaryRow icon="check" label={t('orderdetail.statusRow')}>
                    <span className={`dash-badge is-${orderBadgeTone(record.status)}`}>
                      <span className="dash-badge-dot" aria-hidden="true" />
                      {record.status}
                    </span>
                  </SummaryRow>
                  <SummaryRow icon="calendar" label={t('orderdetail.createdOnRow')}>
                    {formatShortDate(record.createdAt || record.date, i18n.language)}
                  </SummaryRow>
                  {record.updatedAt && (
                    <SummaryRow icon="clock" label={t('orderdetail.updatedOnRow')}>
                      {formatShortDate(record.updatedAt, i18n.language)}
                    </SummaryRow>
                  )}
                  <SummaryRow icon="truck" label={t('orderdetail.estDeliveryRow')} ltr>
                    {record.estDelivery ? formatShortDate(record.estDelivery, i18n.language) : t('orderdetail.notAvailable')}
                  </SummaryRow>
                  <SummaryRow icon="file" label={t('orderdetail.filesRow')} ltr>
                    {t('orderdetail.filesCount', { count: files.length, defaultValue: `${files.length} pcs` })}
                  </SummaryRow>
                  <SummaryRow icon="cpu" label={t('orderdetail.technologyRow')}>
                    {record.technology || t('orderdetail.notAvailable')}
                  </SummaryRow>
                  {(record as { paymentStatus?: string }).paymentStatus && (
                    <SummaryRow icon="check" label={t('orderdetail.paymentStatusRow')}>
                      {(record as { paymentStatus?: string }).paymentStatus}
                    </SummaryRow>
                  )}
                </aside>
              </div>

              {/* ── Selected File Details ── */}
              <section className="qw-details" aria-labelledby="order-details-title">
                <header className="qw-details-head">
                  <span className="qw-details-icon" aria-hidden="true">
                    <Icon name="cube" size={18} />
                  </span>
                  <div>
                    <h3 id="order-details-title">{t('orderdetail.selectedDetails')}</h3>
                    <p>{t('orderdetail.selectedDetailsSub')}</p>
                  </div>
                  {selected && (
                    <div className="qw-details-file">
                      <strong dir="ltr">{selected.name}</strong>
                      {selected.format && (
                        <span className="qw-ext-badge" dir="ltr">
                          {selected.format}
                        </span>
                      )}
                    </div>
                  )}
                </header>
                {specs.length === 0 ? (
                  <p className="qw-empty">{t('orderdetail.specsEmpty')}</p>
                ) : (
                  <div className="qw-spec-grid">
                    {specs.map((s) => (
                      <SpecCell key={s.key} icon={s.icon} label={t(s.labelKey)} value={s.value || ''} ltr={s.ltr} />
                    ))}
                  </div>
                )}
              </section>

              {/* ── Lower grid: Delivery | Notes | Timeline ── */}
              <div className="qw-lower">
                {/* Delivery Information */}
                <section className="qw-card" aria-labelledby="order-delivery-title">
                  <header className="qw-card-head">
                    <span className="qw-card-icon" aria-hidden="true">
                      <Icon name="truck" size={18} />
                    </span>
                    <div>
                      <h3 id="order-delivery-title">{t('orderdetail.delivery')}</h3>
                      <p>{t('orderdetail.deliverySub')}</p>
                    </div>
                  </header>
                  <dl className="qw-delivery-grid">
                    <div>
                      <dt>
                        <Icon name="userRound" size={13} /> {t('orderdetail.recipient')}
                      </dt>
                      <dd>{delivery?.recipient || t('orderdetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="phone" size={13} /> {t('orderdetail.phone')}
                      </dt>
                      <dd dir="ltr">{delivery?.phone || t('orderdetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="mapPin" size={13} /> {t('orderdetail.governorate')}
                      </dt>
                      <dd>{delivery?.governorate || t('orderdetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="building" size={13} /> {t('orderdetail.city')}
                      </dt>
                      <dd>{delivery?.city || t('orderdetail.notAvailable')}</dd>
                    </div>
                    <div className="qw-span-2">
                      <dt>
                        <Icon name="mapPin" size={13} /> {t('orderdetail.fullAddress')}
                      </dt>
                      <dd>{delivery?.fullAddress || t('orderdetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="truck" size={13} /> {t('orderdetail.method')}
                      </dt>
                      <dd>{delivery?.method || t('orderdetail.notAvailable')}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="calendar" size={13} /> {t('orderdetail.estimated')}
                      </dt>
                      <dd>{delivery?.estimated ? formatShortDate(delivery.estimated, i18n.language) : t('orderdetail.notAvailable')}</dd>
                    </div>
                    {delivery?.notes && (
                      <div className="qw-span-2">
                        <dt>
                          <Icon name="message" size={13} /> {t('orderdetail.deliveryNotes')}
                        </dt>
                        <dd>{delivery.notes}</dd>
                      </div>
                    )}
                  </dl>
                </section>

                {/* Notes Column */}
                <div className="qw-notes-col">
                  {/* Customer Notes */}
                  <section className="qw-card" aria-labelledby="order-cnotes-title">
                    <header className="qw-card-head">
                      <span className="qw-card-icon" aria-hidden="true">
                        <Icon name="message" size={18} />
                      </span>
                      <div>
                        <h3 id="order-cnotes-title">{t('orderdetail.customerNotes')}</h3>
                        <p>{t('orderdetail.customerNotesSub')}</p>
                      </div>
                    </header>
                    {record.technicalNotes?.trim() ? (
                      <p className="qw-note-text">{record.technicalNotes}</p>
                    ) : (
                      <p className="qw-empty">{t('orderdetail.noCustomerNotes')}</p>
                    )}
                  </section>

                  {/* Manufacturing Notes */}
                  <section className="qw-card" aria-labelledby="order-mnotes-title">
                    <header className="qw-card-head">
                      <span className="qw-card-icon" aria-hidden="true">
                        <Icon name="gear" size={18} />
                      </span>
                      <div>
                        <h3 id="order-mnotes-title">{t('orderdetail.mfgNotes')}</h3>
                        <p>{t('orderdetail.mfgNotesSub')}</p>
                      </div>
                    </header>
                    {mfgUpdates.length > 0 ? (
                      <div className="qw-mfg-list">
                        {mfgUpdates.map((u) => (
                          <div key={u.id} className="qw-mfg-item">
                            <strong>
                              {u.statusKey
                                ? t(u.labelKey, { status: t(u.statusKey) })
                                : u.statusFallback
                                  ? t(u.labelKey, { status: u.statusFallback })
                                  : t(u.labelKey)}
                            </strong>
                            <span className="qw-mfg-date" dir="ltr">
                              {u.at ? formatShortDate(u.at, i18n.language) : t('orderdetail.timelineNoTime')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="qw-empty">{t('orderdetail.noMfgNotes')}</p>
                    )}
                  </section>
                </div>

                {/* Manufacturing Progress Timeline */}
                <section className="qw-card" aria-labelledby="order-timeline-title">
                  <header className="qw-card-head">
                    <span className="qw-card-icon" aria-hidden="true">
                      <Icon name="clock" size={18} />
                    </span>
                    <div>
                      <h3 id="order-timeline-title">{t('orderdetail.timeline')}</h3>
                      <p>{t('orderdetail.timelineSub')}</p>
                    </div>
                  </header>
                  <ol className="qw-timeline">
                    {timeline.map((node) => (
                      <li key={node.key} className={`qw-tl-node is-${node.state}`}>
                        <span className="qw-tl-marker" aria-hidden="true">
                          {(node.state === 'done' || node.state === 'error') && (
                            <Icon name={node.state === 'error' ? 'close' : 'check'} size={11} />
                          )}
                        </span>
                        <span className="qw-tl-text">
                          <strong>{t(node.labelKey)}</strong>
                          <span className="qw-tl-time" dir="ltr">
                            {node.at ? formatShortDate(node.at, i18n.language) : t('orderdetail.timelineNoTime')}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              {/* ── Footer ── */}
              <footer className="qw-foot">
                <span />
                <button type="button" className="btn btn-outline qw-close-btn" onClick={onClose}>
                  <Icon name="close" size={15} />
                  {t('common.close', { defaultValue: 'Close' })}
                </button>
              </footer>
            </>
          )}
        </div>
      )}
    </AnimatedModal>
  );
};
