import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { CadFile, Order, OrderStatus } from '../../types';
import { ApiError, ApiService, CadGeometryData } from '../../services/api';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { Icon, IconName } from '../ui/Icon';
import { CadGeometryViewer } from '../manufacturing/CadGeometryViewer';
import { OrderDetailModal } from '../dashboard/OrderDetailModal';

// Canonical CAM LABS order lifecycle — the backend is the source of truth for
// the valid statuses (ORDER_LIFECYCLE_STATUSES in the admin API). This only
// orders them for display; it never invents intermediate states.
const LIFECYCLE: Array<{ key: OrderStatus; labelKey: string; statusClass: string }> = [
  { key: 'In Review', labelKey: 'order.status.inReview', statusClass: 'in-review' },
  { key: 'In Production', labelKey: 'order.status.inProduction', statusClass: 'in-production' },
  { key: 'Quality Inspection', labelKey: 'order.status.qualityInspection', statusClass: 'quality-inspection' },
  { key: 'Delivered', labelKey: 'order.status.delivered', statusClass: 'delivered' },
];

const statusIndex = (status: OrderStatus): number => LIFECYCLE.findIndex((s) => s.key === status);

const statusClassName = (status: OrderStatus): string => {
  const normalized = status.toLowerCase().replace(/[^a-z]/g, '-');
  return `oc-status oc-status--${normalized}`;
};

// i18n key for a given backend status, or the raw status string if unknown.
const LABEL_BY_STATUS: Record<string, string> = {
  'in-review': 'order.status.inReview',
  'in-production': 'order.status.inProduction',
  'quality-inspection': 'order.status.qualityInspection',
  delivered: 'order.status.delivered',
  cancelled: 'order.status.cancelled',
};

const orderStatusKey = (status: OrderStatus): string => {
  const normalized = status.toLowerCase().replace(/[^a-z]/g, '-');
  return LABEL_BY_STATUS[normalized] || status;
};

// Per-status badge icon — mirrors the reference design's status glyphs.
const STATUS_ICON: Partial<Record<OrderStatus, IconName>> = {
  'In Review': 'clock',
  'In Production': 'gear',
  'Quality Inspection': 'shieldCheck',
  Delivered: 'check',
  Cancelled: 'close',
};

const StatusGlyph: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const icon = STATUS_ICON[status];
  return icon ? <Icon name={icon} size={12} /> : <span className="oc-status__dot" />;
};

const formatPrice = (value?: string | null): string => value || '—';

// "سيتم تحديده لاحقًا" / "To be determined" fallback for missing delivery.
const deliveryFallback = (t: TFunction): string => t('orderCenter.tbd');

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(i18n.language.startsWith('ar') ? 'ar-EG' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

type TFunction = (key: string, opts?: Record<string, unknown>) => string;

const PAGE_SIZE = 6;

// Summary cards — accent + icon per status. Counts are real, derived from data.
const SUMMARY_DEFS: Array<{ cls: string; valueKey: 'total' | 'inReview' | 'inProduction' | 'quality' | 'delivered'; labelKey: string; icon: IconName }> = [
  { cls: 'is-total', valueKey: 'total', labelKey: 'orderCenter.totalOrders', icon: 'cube' },
  { cls: 'is-in-review', valueKey: 'inReview', labelKey: 'order.status.inReview', icon: 'clock' },
  { cls: 'is-in-production', valueKey: 'inProduction', labelKey: 'order.status.inProduction', icon: 'network' },
  { cls: 'is-quality', valueKey: 'quality', labelKey: 'order.status.qualityInspection', icon: 'shieldCheck' },
  { cls: 'is-delivered', valueKey: 'delivered', labelKey: 'order.status.delivered', icon: 'check' },
];

export const OrderCenter: React.FC = () => {
  const { currentUser } = useAuth();
  const { startManufacturingRequest, pendingOrderDetailId, consumeOrderDetail } = useStore();
  const { t } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [page, setPage] = useState(1);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const fresh = await ApiService.getOrders();
      setOrders(fresh || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('orderCenter.errorTitle'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load real orders whenever the customer reaches the dashboard.
  useEffect(() => { void loadOrders(); }, [loadOrders, currentUser?.id]);

  // Deep-open if pendingOrderDetailId is set.
  useEffect(() => {
    if (pendingOrderDetailId) {
      const id = pendingOrderDetailId;
      consumeOrderDetail();
      const found = orders.find((o) => o.id === id);
      setSelectedOrder(found || ({ id } as Order));
    }
  }, [pendingOrderDetailId, consumeOrderDetail, orders]);

  const copyOrderId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* noop */
    }
  };

  const summary = useMemo(() => {
    const count = (status: OrderStatus) => orders.filter((o) => o.status === status).length;
    return {
      total: orders.length,
      inReview: count('In Review'),
      inProduction: count('In Production'),
      quality: count('Quality Inspection'),
      delivered: count('Delivered'),
    };
  }, [orders]);

  // Client-side search (order ID / file name) + status filter over real data.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      const fileName = o.cadFiles?.[0]?.cadFile?.name || '';
      return o.id.toLowerCase().includes(q) || o.partName.toLowerCase().includes(q) || fileName.toLowerCase().includes(q);
    });
  }, [orders, query, statusFilter]);

  // Reset to first page whenever filters change.
  useEffect(() => { setPage(1); }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageOrders = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const searchRef = React.useRef<HTMLInputElement>(null);

  if (!currentUser) {
    return <main className="order-center"><div className="order-center__inner"><p>{t('dashboard.signInRequired')}</p></div></main>;
  }

  const showSummary = !isLoading && !error && orders.length > 0;
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <main className="order-center">
      <div className="order-center__inner">
        {/* Header */}
        <header className="order-center__header">
          <div>
            <h1 className="order-center__title">{t('orderCenter.title')}</h1>
            <p className="order-center__subtitle">{t('orderCenter.subtitle')}</p>
          </div>
          <div className="order-center__actions">
            <button className="btn btn-primary order-center__new-btn" onClick={() => startManufacturingRequest()}>
              <Icon name="plusCircle" size={15} />
              {t('orderCenter.newRequest')}
            </button>
          </div>
        </header>

        {/* Error state */}
        {error && (
          <div className="oc-state is-error" role="alert">
            <span className="oc-state__icon"><Icon name="alert" size={22} /></span>
            <strong className="oc-state__title">{t('orderCenter.errorTitle')}</strong>
            <p className="oc-state__text">{t('orderCenter.errorBody')}</p>
            <button className="btn btn-sm btn-outline" onClick={() => void loadOrders()}>{t('orderCenter.retry')}</button>
          </div>
        )}

        {/* Loading state — skeletons, never demo orders */}
        {isLoading && (
          <div className="oc-loading" aria-busy="true" aria-label={t('orderCenter.loading')}>
            <div className="oc-skeleton" />
            <div className="oc-skeleton" />
            <div className="oc-skeleton" />
            <div className="oc-skeleton" />
          </div>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <div className="oc-state">
            <span className="oc-state__icon"><Icon name="cube" size={22} /></span>
            <strong className="oc-state__title">{t('orderCenter.emptyTitle')}</strong>
            <p className="oc-state__text">{t('orderCenter.emptyBody')}</p>
            <button className="btn btn-primary cam-shine-auto" onClick={() => startManufacturingRequest()}>
              <Icon name="plusCircle" size={15} />
              {t('orderCenter.startManufacturing')}
            </button>
          </div>
        )}

        {/* Summary cards — real, derived from orders */}
        {showSummary && (
          <div className="oc-summary" aria-label={t('orderCenter.summary')}>
            {SUMMARY_DEFS.map((def) => (
              <div key={def.valueKey} className={`oc-summary__card ${def.cls}`}>
                <span className="oc-summary__icon"><Icon name={def.icon} size={20} /></span>
                <div className="oc-summary__body">
                  <span className="oc-summary__value">{summary[def.valueKey]}</span>
                  <span className="oc-summary__label">{t(def.labelKey)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search + filter */}
        {showSummary && (
          <div className="oc-filters">
            <div className="oc-search">
              <span className="oc-search__icon"><Icon name="search" size={16} /></span>
              <input
                ref={searchRef}
                className="oc-search__input"
                type="search"
                placeholder={t('orderCenter.searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t('orderCenter.searchPlaceholder')}
              />
            </div>
            <div className="oc-filter">
              <span className="oc-filter__icon"><Icon name="filter" size={16} /></span>
              <select
                className="oc-filter__select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
                aria-label={t('orderCenter.filterLabel')}
              >
                <option value="all">{t('orderCenter.filterAll')}</option>
                <option value="In Review">{t('order.status.inReview')}</option>
                <option value="In Production">{t('order.status.inProduction')}</option>
                <option value="Quality Inspection">{t('order.status.qualityInspection')}</option>
                <option value="Delivered">{t('order.status.delivered')}</option>
                <option value="Cancelled">{t('order.status.cancelled')}</option>
              </select>
            </div>
          </div>
        )}

        {/* Order grid */}
        {showSummary && (
          <section aria-label={t('orderCenter.yourOrders')}>
            <div className="oc-section__head">
              <div className="oc-section__title">
                <span>{t('orderCenter.yourOrders')}</span>
                <span className="oc-section__count">{filtered.length} {t('orderCenter.ordersCount')}</span>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="oc-state">
                <span className="oc-state__icon"><Icon name="search" size={22} /></span>
                <strong className="oc-state__title">{t('orderCenter.noResultsTitle')}</strong>
                <p className="oc-state__text">{t('orderCenter.noResultsBody')}</p>
                <button className="btn btn-sm btn-outline" onClick={() => { setQuery(''); setStatusFilter('all'); searchRef.current?.focus(); }}>
                  {t('orderCenter.clearFilters')}
                </button>
              </div>
            ) : (
              <div className="oc-list" role="list">
                {pageOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    copiedId={copiedId}
                    onCopy={() => void copyOrderId(order.reference || order.id)}
                    onOpen={() => setSelectedOrder(order)}
                    t={t}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <div className="oc-pagination">
                <span className="oc-pagination__info">
                  {t('orderCenter.paginationInfo', { from, to, total: filtered.length })}
                </span>
                <div className="oc-pagination__controls">
                  <button
                    className="oc-pagination__btn"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                    aria-label={t('orderCenter.prevPage')}
                  >
                    <Icon name="arrowLeft" size={14} />
                    {t('orderCenter.prevPage')}
                  </button>
                  <span className="oc-pagination__page">{t('orderCenter.pageOf', { page: safePage, total: totalPages })}</span>
                  <button
                    className="oc-pagination__btn"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                    aria-label={t('orderCenter.nextPage')}
                  >
                    {t('orderCenter.nextPage')}
                    <Icon name="arrowRight" size={14} />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </main>
  );
};

const statusStepsFor = (order: Order): Array<{ labelKey: string; state: 'done' | 'current' | 'pending' }> => {
  const current = statusIndex(order.status);
  if (order.status === 'Cancelled') {
    return LIFECYCLE.map((stage) => ({ labelKey: stage.labelKey, state: 'pending' as const }));
  }
  return LIFECYCLE.map((stage, index) => ({
    labelKey: stage.labelKey,
    state: index < current ? 'done' : index === current ? 'current' : 'pending',
  }));
};

// Formats the CAD pipeline can serve as a viewer asset. Mirrors the terminal
// availability check inside CadGeometryViewer so the card can drop the viewer
// (and keep the glyph) for files that will never display.
const VIEWER_ASSET_FORMATS = ['STL', 'OBJ', 'PLY', 'DXF', 'SVG', 'PDF', 'STEP', 'STP', 'IGES', 'IGS'];

// Order card preview: keeps the static cube glyph as the tile's base layer and
// lazily mounts a real CadGeometryViewer (thumbnail mode) over it only once the
// card approaches the viewport, so a page never boots all WebGL canvases at once.
// While the viewer loads, errors or the file has no renderable asset, the layer
// stays transparent or unmounts and the glyph shows through (the viewer's own
// state UI is hidden via .oc-card__preview-canvas CSS). The layer is also
// pointer-transparent, so card click-to-open and keyboard activation keep working
// across the whole tile.
const OrderCardCadPreview: React.FC<{ file: CadFile }> = ({ file }) => {
  const layerRef = React.useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isRenderable, setIsRenderable] = useState(true);

  useEffect(() => {
    const element = layerRef.current;
    if (!element || isNearViewport) return;
    // Very old browsers without IntersectionObserver: degrade to eager mounting.
    if (typeof IntersectionObserver === 'undefined') { setIsNearViewport(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '180px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isNearViewport]);

  // CadGeometryViewer reports every geometry fetch through onGeometry. Mirror its
  // terminal availability test: once COMPLETE but not renderable, the viewer will
  // never show a canvas — unmount it so the glyph fallback remains. Fetch errors
  // never reach this callback; the glyph shows through in that case too.
  const handleGeometry = useCallback((geometry: CadGeometryData) => {
    if (geometry.status !== 'COMPLETE') return; // still processing — the viewer keeps polling
    setIsRenderable(
      geometry.metadata?.geometryStatus === 'READY'
      && geometry.metadata?.viewerAsset?.available === true
      && VIEWER_ASSET_FORMATS.includes(geometry.format),
    );
  }, []);

  if (!isRenderable) return null;

  return (
    <div ref={layerRef} className="oc-card__preview-canvas">
      {isNearViewport && <CadGeometryViewer file={file} thumbnail onGeometry={handleGeometry} />}
    </div>
  );
};

const OrderCard: React.FC<{ order: Order; copiedId: string | null; onCopy: () => void; onOpen: () => void; t: TFunction }> = ({ order, copiedId, onCopy, onOpen, t }) => {
  const steps = statusStepsFor(order);
  const cad = order.cadFiles?.[0]?.cadFile;
  const fileName = cad?.name || t('orderCenter.notProvided');
  const reference = order.reference || order.id;
  const delivery = order.estDelivery ? formatDate(order.estDelivery) : deliveryFallback(t);
  const updated = formatDate(order.updatedAt || order.createdAt);

  return (
    <article
      className="oc-card"
      role="listitem"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      aria-label={t('orderCenter.openOrder', { id: reference })}
    >
      <div className="oc-card__top">
        <div className="oc-card__preview" aria-hidden="true">
          <div className="oc-card__preview-glyph">
            <Icon name="cube" size={26} />
          </div>
          {cad && <OrderCardCadPreview key={cad.id} file={cad} />}
          <div className="oc-card__preview-meta">
            <span className="oc-card__preview-format">{cad?.format || t('orderCenter.cadUnavailable')}</span>
            {cad?.dimensions && <span className="oc-card__preview-dims">{cad.dimensions}</span>}
          </div>
        </div>
        <div className="oc-card__head">
          <div className="oc-card__id-row">
            <span className="oc-card__id" title={order.id} dir="ltr">{reference}</span>
            <button className={`oc-card__copy${copiedId === reference ? ' is-copied' : ''}`} onClick={(e) => { e.stopPropagation(); onCopy(); }} title={t('orderCenter.copyId')} aria-label={t('orderCenter.copyId')}>
              {copiedId === reference ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}
            </button>
          </div>
          <div className="oc-card__name" title={order.partName || fileName}>{order.partName || fileName}</div>
          <div className="oc-card__status-row">
            <span className={statusClassName(order.status)}>
              <StatusGlyph status={order.status} />
              {t(orderStatusKey(order.status))}
            </span>
          </div>
        </div>
      </div>

      <div className="oc-card__body">
        <div className="oc-card__info">
          <div className="oc-card__grid">
            <OCKV icon="cube" label={t('dashboard.material')} value={order.material || '—'} />
            <OCKV icon="gear" label={t('dashboard.process')} value={order.technology || '—'} />
            <OCKV icon="layers3" label={t('dashboard.qty')} value={`${order.quantity} ${t('dashboard.pcs')}`} />
            <OCKV icon="database" label={t('orderCenter.currentPrice')} value={<span className="oc-card__price"><span className="oc-kv__value--price">{formatPrice(order.totalCost)}</span></span>} />
            <OCKV icon="calendar" label={t('order.delivery')} value={delivery} />
            <OCKV icon="clock" label={t('order.updated')} value={updated} />
          </div>
        </div>

        <div className="oc-timeline" aria-label={t('orderCenter.progress')}>
          {steps.map((step) => (
            <div key={step.labelKey} className={`oc-timeline__step is-${step.state}`}>
              <span className="oc-timeline__node">
                {step.state === 'done' ? (
                  <Icon name="check" size={12} />
                ) : (
                  <span className="oc-timeline__dot" />
                )}
              </span>
              <span className="oc-timeline__label">{t(step.labelKey)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="oc-card__footer">
        <span className="oc-card__meta" title={fileName}>{fileName}</span>
        <button type="button" className="oc-card__cta" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          {t('orderCenter.viewDetails')}
          <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </article>
  );
};

// small key/value display helper with optional semantic icon
const OCKV: React.FC<{ label: string; value: React.ReactNode; icon?: IconName }> = ({ label, value, icon }) => (
  <div className="oc-kv">
    <div className="oc-kv__label">
      {icon && <Icon name={icon} size={13} />}
      <span>{label}</span>
    </div>
    <div className="oc-kv__value">{value}</div>
  </div>
);
