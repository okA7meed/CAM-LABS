import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { CadFile, Order, Quote } from '../../types';
import { ApiService } from '../../services/api';
import { Icon, IconName } from '../ui/Icon';
import {
  activeCustomerQuotes,
  dedupExtensions,
  fileExtension,
  formatRef,
  formatShortDate,
  hasPendingDeletionRequest,
  isQuoteDeletable,
  newestFirst,
  orderBadgeTone,
  orderDisplayFiles,
  parseQuoteFileIds,
  primaryDisplayFile,
  quoteBadgeTone,
  quoteDisplayFiles,
  summarizeOrders,
  summarizeQuotes,
} from './dashUtils';
import { useQuoteDelete } from './useQuoteDelete';
import { QuoteDeleteDialog } from './QuoteDeleteDialog';
import { QuoteDetailModal } from './QuoteDetailModal';
import { OrderDetailModal } from './OrderDetailModal';
import { DashCadThumb } from './DashCadThumb';
import { useDashboardThumbnails } from './useDashboardThumbnails';

const RECENT_LIMIT = 5;

const ORDER_STATS: Array<{ key: 'total' | 'inReview' | 'inProduction' | 'quality' | 'delivered'; labelKey: string; icon: IconName; tone: string }> = [
  { key: 'total', labelKey: 'dashboard.totalOrders', icon: 'cube', tone: 'is-blue' },
  { key: 'inReview', labelKey: 'dashboard.inReview', icon: 'clock', tone: 'is-amber' },
  { key: 'inProduction', labelKey: 'dashboard.inProduction', icon: 'gear', tone: 'is-cyan' },
  { key: 'quality', labelKey: 'dashboard.qualityInspection', icon: 'shieldCheck', tone: 'is-purple' },
  { key: 'delivered', labelKey: 'dashboard.delivered', icon: 'check', tone: 'is-green' },
];

const QUOTE_STATS: Array<{ key: 'total' | 'ready' | 'pending' | 'approved' | 'rejected'; labelKey: string; icon: IconName; tone: string }> = [
  { key: 'total', labelKey: 'dashboard.totalQuotes', icon: 'file', tone: 'is-purple' },
  { key: 'ready', labelKey: 'dashboard.readyApproval', icon: 'clipboard', tone: 'is-blue' },
  { key: 'pending', labelKey: 'dashboard.pending', icon: 'clock', tone: 'is-amber' },
  { key: 'approved', labelKey: 'dashboard.approved', icon: 'check', tone: 'is-green' },
  { key: 'rejected', labelKey: 'dashboard.rejected', icon: 'close', tone: 'is-red' },
];

/** Compact "N CAD files • STL, STEP" metadata for multi-file records. */
const FileCountMeta: React.FC<{ files: CadFile[] }> = ({ files }) => {
  const { t } = useTranslation();
  if (files.length <= 1) return null;
  const types = dedupExtensions(files).join(', ');
  const label = types
    ? t('dashboard.cadFilesWithTypes', { count: files.length, types })
    : t('dashboard.cadFiles', { count: files.length });
  return (
    <span className="dash-row-files" dir="ltr">
      {label}
    </span>
  );
};

export const DashboardView: React.FC = () => {
  const { currentUser } = useAuth();
  const { setActiveView, startManufacturingRequest, showToast, refreshCustomerData } = useStore();
  const { t, i18n } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [cadById, setCadById] = useState<Map<string, CadFile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // Unfiltered fetches: counters must see Approved/Rejected quotes too
      // (the shared store list intentionally hides converted quotes).
      // The CAD catalog join is one extra request (never N+1): it backfills
      // full file objects (with latestVersion) for order embeds and resolves
      // quote `cadFileIds` without touching CAD binaries.
      const [freshOrders, freshQuotes, freshCad] = await Promise.all([
        ApiService.getOrders().catch(() => null),
        ApiService.getQuotes().catch(() => null),
        ApiService.getCadFiles().catch(() => null),
      ]);
      if (freshOrders === null && freshQuotes === null) {
        setLoadError(true);
      } else {
        setOrders(freshOrders || []);
        // Domain rule: converted Quotes have left Quotes for Orders. The API
        // already scopes to active rows; this guards stale caches too.
        setQuotes(activeCustomerQuotes(freshQuotes || []));
        const map = new Map<string, CadFile>();
        for (const file of freshCad || []) {
          if (file?.id) map.set(file.id, file);
        }
        setCadById(map);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, currentUser?.id]);

  const orderSummary = useMemo(() => summarizeOrders(orders), [orders]);
  const quoteSummary = useMemo(() => summarizeQuotes(quotes), [quotes]);
  const recentOrders = useMemo(() => newestFirst(orders).slice(0, RECENT_LIMIT), [orders]);
  const recentQuotes = useMemo(() => newestFirst(quotes).slice(0, RECENT_LIMIT), [quotes]);

  /** Enriched display files per recent row (embedded order files upgraded
   *  with catalog versions; quote ids resolved through the catalog). */
  const orderFilesById = useMemo(() => {
    const out = new Map<string, CadFile[]>();
    for (const order of recentOrders) {
      const embedded = orderDisplayFiles(order);
      const enriched = embedded.map((f) => cadById.get(f.id) || f);
      out.set(order.id, enriched);
    }
    return out;
  }, [recentOrders, cadById]);

  const quoteFilesById = useMemo(() => {
    const out = new Map<string, CadFile[]>();
    for (const quote of recentQuotes) {
      const ids = parseQuoteFileIds(quote.cadFileIds);
      if (ids.length > 0) {
        out.set(quote.id, quoteDisplayFiles(quote, cadById));
      } else {
        out.set(quote.id, []);
      }
    }
    return out;
  }, [recentQuotes, cadById]);

  /** Primary files only — one render job per row, never the full geometry. */
  const primaryFiles = useMemo(() => {
    const files: CadFile[] = [];
    for (const order of recentOrders) {
      const primary = primaryDisplayFile(orderFilesById.get(order.id) || []);
      if (primary) files.push(primary);
    }
    for (const quote of recentQuotes) {
      const primary = primaryDisplayFile(quoteFilesById.get(quote.id) || []);
      if (primary) files.push(primary);
    }
    return files;
  }, [recentOrders, recentQuotes, orderFilesById, quoteFilesById]);

  const thumbs = useDashboardThumbnails(primaryFiles);

  const handleDeleted = useCallback(
    (id: string) => {
      // Deletion-by-approval: the Quote stays visible with a pending state.
      // Mark it locally so the badge + disabled button render instantly.
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === id
            ? { ...q, deletionRequests: [{ id: 'pending', status: 'PENDING', requestedAt: new Date().toISOString() }] }
            : q,
        ),
      );
      void refreshCustomerData();
      showToast(t('dashboard.deleteQuoteTitle'), t('dashboard.quoteDeleted'), 'success');
    },
    [refreshCustomerData, showToast, t],
  );
  const quoteDelete = useQuoteDelete(handleDeleted);

  if (!currentUser) {
    return (
      <main className="dashboard-layout">
        <div className="container">
          <p>{t('dashboard.signInRequired')}</p>
        </div>
      </main>
    );
  }

  const firstName = (currentUser.name || '').trim().split(/\s+/)[0] || currentUser.name;

  return (
    <main className="dashboard-layout dash-page">
      <div className="container dash-container">
        <header className="dash-welcome">
          <div className="dash-welcome-text">
            <h1>
              {t('dashboard.welcome', { name: firstName })}{' '}
              <span role="img" aria-label={t('dashboard.welcomeWave')}>
                👋
              </span>
            </h1>
            <p>{t('dashboard.welcomeSub')}</p>
          </div>
          <div className="dash-welcome-art" aria-hidden="true">
            <span className="dash-welcome-orb" />
            <span className="dash-welcome-grid" />
            <span className="dash-welcome-chip is-back">
              <Icon name="gear" size={20} />
            </span>
            <span className="dash-welcome-chip is-front">
              <Icon name="cube" size={26} />
            </span>
          </div>
        </header>

        {loading && (
          <div className="dash-loading" aria-busy="true" aria-label={t('dashboard.loading')}>
            <div className="skeleton dash-skeleton" />
            <div className="skeleton dash-skeleton" />
          </div>
        )}

        {!loading && loadError && (
          <div className="dash-state" role="alert">
            <strong>{t('dashboard.loadFailed')}</strong>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
              {t('dashboard.retry')}
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <>
            <div className="dash-panels">
              {/* ── Orders ── */}
              <section className="dash-panel dash-orders" aria-labelledby="dash-orders-title">
                <header className="dash-panel-head">
                  <span className="dash-panel-icon is-orders" aria-hidden="true">
                    <Icon name="cube" size={22} />
                  </span>
                  <div className="dash-panel-titles">
                    <h2 id="dash-orders-title">{t('dashboard.ordersTitle')}</h2>
                    <p>{t('dashboard.ordersDesc')}</p>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm dash-head-cta" onClick={() => setActiveView('orders')}>
                    {t('dashboard.viewAllOrders')}
                    <Icon name="arrowRight" size={14} />
                  </button>
                </header>

                <div className="dash-stats" role="list" aria-label={t('dashboard.ordersTitle')}>
                  {ORDER_STATS.map((s) => (
                    <div key={s.key} role="listitem" className={`dash-stat ${s.tone}`}>
                      <span className="dash-stat-top">
                        <span className="dash-stat-icon" aria-hidden="true">
                          <Icon name={s.icon} size={17} />
                        </span>
                        <span className="dash-stat-value" dir="ltr">
                          {orderSummary[s.key]}
                        </span>
                      </span>
                      <span className="dash-stat-label">{t(s.labelKey)}</span>
                    </div>
                  ))}
                </div>

                <div className="dash-recent">
                  <div className="dash-recent-head">
                    <div>
                      <h3>{t('dashboard.recentOrders')}</h3>
                      <p>{t('dashboard.recentOrdersDesc')}</p>
                    </div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveView('orders')}>
                      {t('dashboard.seeAll')}
                      <Icon name="arrowRight" size={14} />
                    </button>
                  </div>

                  {recentOrders.length === 0 ? (
                    <div className="dash-empty">
                      <p>{t('dashboard.noOrders')}</p>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => startManufacturingRequest()}>
                        <Icon name="plus" size={15} />
                        {t('dashboard.startManufacturing')}
                      </button>
                    </div>
                  ) : (
                    <ul className="dash-rows">
                      {recentOrders.map((order) => {
                        const files = orderFilesById.get(order.id) || [];
                        const primary = primaryDisplayFile(files);
                        const fallbackName = order.cadFiles?.[0]?.cadFile?.name || order.partName;
                        const fileName = primary?.name || fallbackName;
                        const ext = fileExtension(fileName);
                        return (
                          <li key={order.id} className="dash-row">
                            <DashCadThumb
                              files={files}
                              primary={primary}
                              thumb={primary ? thumbs[primary.id] : undefined}
                              alt={t('dashboard.cadPreviewAlt', { name: fileName })}
                            />
                            {!primary && ext && <span hidden>{ext}</span>}
                            <span className="dash-row-main">
                              <strong dir="ltr">{formatRef(order.reference, order.id)}</strong>
                              <span className="dash-row-sub">{fileName}</span>
                              <span className="dash-row-meta">
                                <span className="dash-row-date">{formatShortDate(order.createdAt || order.date, i18n.language)}</span>
                                <FileCountMeta files={files} />
                              </span>
                            </span>
                            <span className={`dash-badge is-${orderBadgeTone(order.status)}`}>
                              <span className="dash-badge-dot" aria-hidden="true" />
                              {order.status}
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm dash-details-btn"
                              onClick={() => setDetailOrder(order)}
                            >
                              {t('dashboard.viewDetails')}
                              <Icon name="arrowRight" size={14} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>

              {/* ── Quotes ── */}
              <section className="dash-panel dash-quotes" aria-labelledby="dash-quotes-title">
                <header className="dash-panel-head">
                  <span className="dash-panel-icon is-quotes" aria-hidden="true">
                    <Icon name="file" size={22} />
                  </span>
                  <div className="dash-panel-titles">
                    <h2 id="dash-quotes-title">{t('dashboard.quotesTitle')}</h2>
                    <p>{t('dashboard.quotesDesc')}</p>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm dash-head-cta is-quotes" onClick={() => setActiveView('quotes')}>
                    {t('dashboard.viewAllQuotes')}
                    <Icon name="arrowRight" size={14} />
                  </button>
                </header>

                <div className="dash-stats" role="list" aria-label={t('dashboard.quotesTitle')}>
                  {QUOTE_STATS.map((s) => (
                    <div key={s.key} role="listitem" className={`dash-stat ${s.tone}`}>
                      <span className="dash-stat-top">
                        <span className="dash-stat-icon" aria-hidden="true">
                          <Icon name={s.icon} size={17} />
                        </span>
                        <span className="dash-stat-value" dir="ltr">
                          {quoteSummary[s.key]}
                        </span>
                      </span>
                      <span className="dash-stat-label">{t(s.labelKey)}</span>
                    </div>
                  ))}
                </div>

                <div className="dash-recent">
                  <div className="dash-recent-head">
                    <div>
                      <h3>{t('dashboard.recentQuotes')}</h3>
                      <p>{t('dashboard.recentQuotesDesc')}</p>
                    </div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveView('quotes')}>
                      {t('dashboard.seeAll')}
                      <Icon name="arrowRight" size={14} />
                    </button>
                  </div>

                  {recentQuotes.length === 0 ? (
                    <div className="dash-empty">
                      <p>{t('dashboard.noQuotes')}</p>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => startManufacturingRequest()}>
                        <Icon name="plus" size={15} />
                        {t('dashboard.newQuote')}
                      </button>
                    </div>
                  ) : (
                    <ul className="dash-rows">
                      {recentQuotes.map((quote) => {
                        const files = quoteFilesById.get(quote.id) || [];
                        const primary = primaryDisplayFile(files);
                        const fileName = primary?.name || quote.partName;
                        return (
                          <li key={quote.id} className="dash-row">
                            {primary ? (
                              <DashCadThumb
                                files={files}
                                primary={primary}
                                thumb={thumbs[primary.id]}
                                alt={t('dashboard.cadPreviewAlt', { name: fileName })}
                              />
                            ) : (
                              <span className="dash-thumb is-single" aria-hidden="true">
                                <span className="dash-thumb-fallback" role="img" aria-label={t('dashboard.previewUnavailable', { name: fileName })}>
                                  <Icon name="cube" size={26} />
                                  {fileExtension(fileName) && (
                                    <span className="dash-thumb-ext" dir="ltr">
                                      {fileExtension(fileName)}
                                    </span>
                                  )}
                                </span>
                              </span>
                            )}
                            <span className="dash-row-main">
                              <strong dir="ltr">{formatRef(quote.reference, quote.id)}</strong>
                              <span className="dash-row-sub">{fileName}</span>
                              <span className="dash-row-meta">
                                <span className="dash-row-date">{formatShortDate(quote.validUntil, i18n.language)}</span>
                                <FileCountMeta files={files} />
                              </span>
                            </span>
                            <span className={`dash-badge is-${quoteBadgeTone(quote.status)}`}>
                              <span className="dash-badge-dot" aria-hidden="true" />
                              {quote.status}
                            </span>
                            {hasPendingDeletionRequest(quote) && (
                              <span className="dash-badge is-amber dash-pending-badge">
                                <span className="dash-badge-dot" aria-hidden="true" />
                                {t('dashboard.deletionRequested')}
                              </span>
                            )}
                            <span className="dash-row-actions">
                              <button type="button" className="btn btn-outline btn-sm dash-details-btn" onClick={() => setDetailQuote(quote)}>
                                {t('dashboard.viewDetails')}
                                <Icon name="arrowRight" size={14} />
                              </button>
                              {isQuoteDeletable(quote) && (
                                <button
                                  type="button"
                                  className="btn btn-sm dash-delete-btn account-btn-danger-ghost"
                                  onClick={() => quoteDelete.askDelete(quote)}
                                  aria-label={`${t('dashboard.deleteQuoteTitle')}: ${formatRef(quote.reference, quote.id)}`}
                                >
                                  <Icon name="trash" size={15} />
                                </button>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            </div>

            <div className="dash-ctas">
              <section className="dash-cta" aria-labelledby="dash-help-title">
                <span className="dash-cta-icon" aria-hidden="true">
                  <Icon name="headset" size={22} />
                </span>
                <div>
                  <h3 id="dash-help-title">{t('dashboard.needHelp')}</h3>
                  <p>{t('dashboard.needHelpBody')}</p>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveView('contact')}>
                  {t('dashboard.contactSupport')}
                  <Icon name="arrowRight" size={14} />
                </button>
              </section>
              <section className="dash-cta" aria-labelledby="dash-new-title">
                <span className="dash-cta-icon" aria-hidden="true">
                  <Icon name="gear" size={22} />
                </span>
                <div>
                  <h3 id="dash-new-title">{t('dashboard.newProject')}</h3>
                  <p>{t('dashboard.newProjectBody')}</p>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => startManufacturingRequest()}>
                  {t('dashboard.newRequest')}
                  <Icon name="arrowRight" size={14} />
                </button>
              </section>
            </div>
          </>
        )}

        <QuoteDetailModal quote={detailQuote} onClose={() => setDetailQuote(null)} onDeleted={handleDeleted} />
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
        <QuoteDeleteDialog
          quote={quoteDelete.target}
          reason={quoteDelete.reason}
          onReasonChange={quoteDelete.setReason}
          busy={quoteDelete.busy}
          errorMessage={
            quoteDelete.errorCode === 'QUOTE_PROTECTED'
              ? t('dashboard.deleteProtected')
              : quoteDelete.errorMessage
          }
          onCancel={quoteDelete.cancel}
          onConfirm={() => void quoteDelete.confirm()}
        />
      </div>
    </main>
  );
};
