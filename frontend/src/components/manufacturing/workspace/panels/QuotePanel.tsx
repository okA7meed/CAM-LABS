import { useTranslation as useTranslationHook } from 'react-i18next';
import { MultiFileQuotation } from '../../../../services/api';
import { PriceEstimateNotice } from '../../../ui/PriceEstimateNotice';
import { PriceTransition } from '../../../ui/PriceTransition';
import { Icon } from '../../../ui/Icon';
import { canSubmitFinal, isMultiFileQuote, priceWithPriority } from '../helpers';
import { PanelShell } from '../PanelShell';
import { PROCESS_INFO, TECH_OPTIONS, PRIORITY_SHIPPING_FEE_EGP, panelIds } from '../constants';
import { FileConfiguration, ProcessId, QuoteData, RequestState, UploadItem } from '../types';

export const QuotePanel = ({ request, quote, isCalculatingQuote, quoteFailed, usableUploadItems, fileConfigurations, thumbnails, thumbFailed, activeThumbIds, selectedSetupId, orderReady, authGateOpen, onConfigUpdate, onSelectItem, isAuthenticated, isSubmitting, onSignIn, onRegister, onSubmit, priorityShipping, onPriorityShippingChange, t: tProp }: {
  request: RequestState;
  quote: QuoteData | null;
  isCalculatingQuote: boolean;
  quoteFailed: boolean;
  usableUploadItems: UploadItem[];
  fileConfigurations: Record<string, FileConfiguration>;
  thumbnails: Record<string, string>;
  thumbFailed: Record<string, true>;
  activeThumbIds: string[];
  selectedSetupId: string | null;
  orderReady: boolean;
  authGateOpen: boolean;
  onConfigUpdate: (u: Partial<FileConfiguration>, itemId?: string | null) => void;
  onSelectItem: (id: string) => void;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  onSignIn: () => void;
  onRegister: () => void;
  onSubmit: () => void;
  priorityShipping: boolean;
  onPriorityShippingChange: (v: boolean) => void;
  t: any;
}) => {
  const { t: tHook } = useTranslationHook();
  const t = tProp || tHook;
  const multiFile = isMultiFileQuote(quote);
  const priceStatus: 'calculating' | 'error' | 'ready' | 'idle' = isCalculatingQuote ? 'calculating' : quoteFailed ? 'error' : quote ? 'ready' : 'idle';
  const activeId = selectedSetupId || usableUploadItems[0]?.id || null;
  const activeFile = usableUploadItems.find((i) => i.id === activeId);
  const activeQuoteFile = multiFile && activeFile?.cadFile ? quote.files.find((f) => f.fileId === activeFile.cadFile!.id) : undefined;
  const techLabel = request.technology ? TECH_OPTIONS.find((o) => o.id === request.technology)?.label || '—' : '—';
  const processTitle = request.process ? PROCESS_INFO[request.process]?.title || '—' : '—';
  const materialLabel = request.material ? t(`request.material.${request.material}`) : '—';
  const totalParts = usableUploadItems.reduce((s, i) => s + (fileConfigurations[i.cadFile!.id]?.quantity || request.quantity || 1), 0);
  const hasValidQuote = Boolean(quote && !isCalculatingQuote && !quoteFailed);
  const manualQuoteVisible = orderReady && !hasValidQuote;

  /* The backend quote base price is the source of truth; priority shipping is a
     derived, visible surcharge on top of it. The quote object itself is never
     mutated, so toggling can never accumulate. */
  const displayTotal = quote ? priceWithPriority(quote.formattedTotalPrice, priorityShipping) : null;

  const thumbFor = (item: UploadItem) => {
    const img = thumbnails[item.id];
    const loading = !img && !thumbFailed[item.id] && activeThumbIds.includes(item.id) && Boolean(item.cadFile);
    if (img) return <span className="mw-qup-file-thumb" aria-hidden="true"><img className="mw-qup-file-thumb-img" src={img} alt="" /></span>;
    if (loading) return <span className="mw-qup-file-thumb" aria-hidden="true"><span className="mw-qup-file-thumb-loader" /></span>;
    return <span className="mw-qup-file-thumb" aria-hidden="true"><Icon name="cube" size={14} /></span>;
  };

  return (
    <>
      {/* Right Panel 1 — Parts & Review */}
      <PanelShell
        id={panelIds.quote}
        icon="clipboard"
        title={t('mw.quote')}
        subtitle={t('mw.quoteSub')}
        className="mw-panel-quote mw-panel-quote-main"
      >
        <div className="mw-qup-body">
          {usableUploadItems.length === 0 ? (
            <div className="mw-qup-no-items">
              <span className="mw-qup-no-items-icon"><Icon name="upload" size={18} /></span>
              <span className="mw-qup-no-items-title">{t('mw.noItems')}</span>
              <span className="mw-qup-no-items-sub">{t('mw.uploadToStart')}</span>
            </div>
          ) : (
            <>
              {/* Order items + per-file quantity */}
              <div className="mw-qup-files">
                <div className="mw-stage-section-label">{t('mw.partsItems')}</div>
                {usableUploadItems.map((item) => {
                  const cfg = fileConfigurations[item.cadFile!.id] || {};
                  const material = cfg.material || request.material;
                  const processId = (cfg.process || request.process) as ProcessId | null;
                  const processTitle = processId ? PROCESS_INFO[processId]?.title || '' : '';
                  const quoteFile = multiFile && item.cadFile ? quote?.files.find((f) => f.fileId === item.cadFile!.id) : undefined;
                  const sel = item.id === activeId;
                  return (
                    <div key={item.id} className={`mw-qup-file-row ${sel ? 'is-active' : ''}`} onClick={() => onSelectItem(item.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelectItem(item.id); }}>
                      {thumbFor(item)}
                      <span className="mw-qup-file-info">
                        <span className="mw-qup-file-name">{item.name}</span>
                        <span className="mw-qup-file-meta">{item.format}{processTitle ? ` · ${processTitle.replace(' Printing', '')}` : ''}{material ? ` · ${t(`request.material.${material}`)}` : ''}</span>
                      </span>
                      <span className="mw-qup-file-price">
                        {quoteFile ? (
                          <span className="mw-qup-file-price-value">{quoteFile.perUnitCost.toFixed(2)}</span>
                        ) : null}
                      </span>
                      <span className="mw-qup-file-qty">
                        <div className="mw-qty-control">
                          <button className="mw-qty-btn" onClick={(e) => { e.stopPropagation(); onConfigUpdate({ quantity: Math.max(1, (cfg.quantity || request.quantity || 1) - 1) }, item.id); }} aria-label={t('mw.decreaseQty')}>−</button>
                          <span className="mw-qty-value">{cfg.quantity || request.quantity || 1}</span>
                          <button className="mw-qty-btn" onClick={(e) => { e.stopPropagation(); onConfigUpdate({ quantity: (cfg.quantity || request.quantity || 1) + 1 }, item.id); }} aria-label={t('mw.increaseQty')}>+</button>
                        </div>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Selected part summary */}
              {activeFile && (
                <div className="mw-qup-part">
                  <span className="mw-qup-part-thumb" aria-hidden="true">
                    {thumbnails[activeFile.id] ? (
                      <img className="mw-qup-part-thumb-img" src={thumbnails[activeFile.id]} alt="" />
                    ) : (
                      <Icon name="cube" size={20} />
                    )}
                  </span>
                  <span className="mw-qup-part-info">
                    <span className="mw-qup-part-name">{activeFile.name}</span>
                    <span className="mw-qup-part-meta">
                      {processTitle}{request.material ? ` · ${materialLabel}` : ''}
                    </span>
                  </span>
                  <span className="mw-qup-part-price">
                    {activeQuoteFile ? (
                      <span className="mw-qup-part-price-value">{activeQuoteFile.perUnitCost.toFixed(2)} {t('mw.perUnit')}</span>
                    ) : quote ? (
                      <span className="mw-qup-part-price-value">{quote.formattedTotalPrice}</span>
                    ) : (
                      <span className="mw-qup-part-price-value mw-qup-part-price-pending">—</span>
                    )}
                  </span>
                </div>
              )}

              {/* Configuration summary */}
              <div className="mw-qup-summary">
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">{t('mw.technology')}</span>
                  <span className="mw-qup-summary-value">{techLabel}</span>
                </div>
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">{t('mw.process')}</span>
                  <span className="mw-qup-summary-value">{processTitle}</span>
                </div>
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">{t('mw.partsCount', { count: usableUploadItems.length })}</span>
                  <span className="mw-qup-summary-value">{totalParts}</span>
                </div>
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">{t('mw.material')}</span>
                  <span className="mw-qup-summary-value">{materialLabel}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </PanelShell>

      {/* Right Panel 2 — Pricing (real engine values only) */}
      <PanelShell
        icon="wallet"
        title={t('mw.pricing')}
        subtitle={t('mw.pricingSub')}
        className="mw-panel-quote-pricing"
      >
        <div className="mw-qup-body">
          {quote ? (
            <div className="mw-qup-pricing cam-fade-up">
              {multiFile && (
                <>
                  {(quote as MultiFileQuotation).quantityDiscountSavings > 0 && (
                    <div className="mw-qup-pricing-row is-discount">
                      <span>{t('mw.qtyDiscount')}</span>
                      <span>-{(quote as MultiFileQuotation).quantityDiscountSavings.toFixed(2)}</span>
                    </div>
                  )}
                  {(quote as MultiFileQuotation).shippingEstimate != null && (
                    <div className="mw-qup-pricing-row">
                      <span>{t('mw.shipping')}</span>
                      <span>{(quote as MultiFileQuotation).shippingEstimate!.toFixed(2)}</span>
                    </div>
                  )}
                  {(quote as MultiFileQuotation).taxEstimate != null && (
                    <div className="mw-qup-pricing-row">
                      <span>{t('mw.tax')}</span>
                      <span>{(quote as MultiFileQuotation).taxEstimate!.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              {priorityShipping && (
                <div className="mw-qup-pricing-row is-fee">
                  <span>{t('mw.priorityShipping')}</span>
                  <span>+{PRIORITY_SHIPPING_FEE_EGP.toFixed(2)}</span>
                </div>
              )}
              <div className="mw-qup-pricing-divider" />
              <div className="mw-qup-pricing-row is-total">
                <span>{t('mw.estimatedTotal')}</span>
                <span className="mw-qup-pricing-total-value">
                  <PriceTransition status={priceStatus} value={displayTotal ?? undefined} calculatingLabel="..." errorLabel="Error" />
                </span>
              </div>
              <PriceEstimateNotice />
            </div>
          ) : (
            <div className="mw-qup-checkout-status">
              <Icon name={isCalculatingQuote ? 'loader' : 'configure'} size={12} />
              {isCalculatingQuote ? t('mw.calculating') : t('mw.pricingEmpty')}
            </div>
          )}

          {/* Shipping */}
          {orderReady && (
            <div className="mw-qup-priority">
              <div className="mw-qup-priority-row">
                <span className="mw-qup-priority-icon" aria-hidden="true"><Icon name="send" size={14} /></span>
                <div className="mw-qup-priority-text">
                  <span className="mw-qup-priority-title">{t('mw.priorityShipping')}</span>
                  <span className="mw-qup-priority-sub">{t('mw.prioritySub')}</span>
                </div>
                <button
                  type="button"
                  className={`mw-toggle ${priorityShipping ? 'is-on' : ''}`}
                  role="switch"
                  aria-checked={priorityShipping}
                  aria-label={t('mw.priorityShipping')}
                  onClick={() => onPriorityShippingChange(!priorityShipping)}
                >
                  <span className="mw-toggle-thumb" />
                </button>
              </div>
              <div className="mw-qup-priority-note" role="note">
                {priorityShipping
                  ? t('mw.priorityOn', { fee: PRIORITY_SHIPPING_FEE_EGP })
                  : t('mw.priorityOff', { fee: PRIORITY_SHIPPING_FEE_EGP })}
              </div>
            </div>
          )}
        </div>
      </PanelShell>

      {/* Right Panel 3 — Checkout */}
      <PanelShell
        icon="shieldCheck"
        title={t('mw.quoteTitle')}
        subtitle={t('mw.quoteTitleSub')}
        className="mw-panel-quote-checkout"
      >
        <div className="mw-qup-body">
          {orderReady && authGateOpen && !isAuthenticated && (
            <div className="mw-qup-auth-gate">
              <div>
                <div className="mw-qup-auth-gate-text">{t('mw.signInToSubmit')}</div>
                <div className="mw-qup-auth-gate-sub">{t('mw.signInSub')}</div>
              </div>
              <div className="mw-qup-auth-gate-actions">
                <button className="mw-btn mw-btn-secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={onSignIn}>{t('mw.signIn')}</button>
                <button className="mw-btn mw-btn-primary" style={{ width: 'auto', padding: '8px 14px' }} onClick={onRegister}>{t('mw.register')}</button>
              </div>
            </div>
          )}

          <button className="mw-btn mw-btn-primary mw-qup-confirm" onClick={onSubmit} disabled={isSubmitting || !canSubmitFinal(quote, isCalculatingQuote, quoteFailed, request, usableUploadItems)}>
            {isSubmitting ? <><span className="mw-spinner" /> {t('mw.submitting')}</> : <><Icon name="check" size={14} /> {t('mw.submitQuote')}</>}
          </button>

          {manualQuoteVisible && (
            <button className="mw-btn mw-btn-secondary mw-qup-manual" onClick={onSubmit} disabled={isSubmitting}>
              <Icon name="file" size={14} /> {t('mw.manualQuote')}
            </button>
          )}
          <div className="mw-qup-secure" aria-hidden="true">
            <Icon name="shieldCheck" size={11} /> {t('mw.quoteOnly')}
          </div>

          {!canSubmitFinal(quote, isCalculatingQuote, quoteFailed, request, usableUploadItems) && !manualQuoteVisible && (
            <div className="mw-qup-checkout-status">
              <Icon name="configure" size={12} /> {t('mw.checkoutEmpty')}
            </div>
          )}
        </div>
      </PanelShell>
    </>
  );
};