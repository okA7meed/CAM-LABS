import { MultiFileQuotation } from '../../../../services/api';
import { PriceEstimateNotice } from '../../../ui/PriceEstimateNotice';
import { PriceTransition } from '../../../ui/PriceTransition';
import { Icon } from '../../../ui/Icon';
import { canSubmitFinal, isMultiFileQuote, priceWithPriority } from '../helpers';
import { PanelShell } from '../PanelShell';
import { PROCESS_INFO, TECH_OPTIONS, PRIORITY_SHIPPING_FEE_EGP, panelIds } from '../constants';
import { FileConfiguration, ProcessId, QuoteData, RequestState, UploadItem } from '../types';

export const QuotePanel = ({ request, quote, isCalculatingQuote, quoteFailed, usableUploadItems, fileConfigurations, thumbnails, thumbFailed, activeThumbIds, selectedSetupId, orderReady, authGateOpen, onConfigUpdate, onSelectItem, isAuthenticated, isSubmitting, onSignIn, onRegister, onSubmit, priorityShipping, onPriorityShippingChange, t }: {
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
        title="Proposed Technical Quote"
        subtitle="Review parts & configuration"
        className="mw-panel-quote mw-panel-quote-main"
      >
        <div className="mw-qup-body">
          {usableUploadItems.length === 0 ? (
            <div className="mw-qup-no-items">
              <span className="mw-qup-no-items-icon"><Icon name="upload" size={18} /></span>
              <span className="mw-qup-no-items-title">No items in quote</span>
              <span className="mw-qup-no-items-sub">Upload files to get started</span>
            </div>
          ) : (
            <>
              {/* Order items + per-file quantity */}
              <div className="mw-qup-files">
                <div className="mw-stage-section-label">Parts / Items</div>
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
                          <button className="mw-qty-btn" onClick={(e) => { e.stopPropagation(); onConfigUpdate({ quantity: Math.max(1, (cfg.quantity || request.quantity || 1) - 1) }, item.id); }} aria-label="Decrease quantity">−</button>
                          <span className="mw-qty-value">{cfg.quantity || request.quantity || 1}</span>
                          <button className="mw-qty-btn" onClick={(e) => { e.stopPropagation(); onConfigUpdate({ quantity: (cfg.quantity || request.quantity || 1) + 1 }, item.id); }} aria-label="Increase quantity">+</button>
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
                      <span className="mw-qup-part-price-value">{activeQuoteFile.perUnitCost.toFixed(2)} EGP / unit</span>
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
                  <span className="mw-qup-summary-label">Technology</span>
                  <span className="mw-qup-summary-value">{techLabel}</span>
                </div>
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">Process</span>
                  <span className="mw-qup-summary-value">{processTitle}</span>
                </div>
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">Parts ({usableUploadItems.length})</span>
                  <span className="mw-qup-summary-value">{totalParts}</span>
                </div>
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">Material</span>
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
        title="Pricing"
        subtitle="Based on your selected configuration"
        className="mw-panel-quote-pricing"
      >
        <div className="mw-qup-body">
          {quote ? (
            <div className="mw-qup-pricing cam-fade-up">
              {multiFile && (
                <>
                  {(quote as MultiFileQuotation).quantityDiscountSavings > 0 && (
                    <div className="mw-qup-pricing-row is-discount">
                      <span>Quantity discount</span>
                      <span>-{(quote as MultiFileQuotation).quantityDiscountSavings.toFixed(2)}</span>
                    </div>
                  )}
                  {(quote as MultiFileQuotation).shippingEstimate != null && (
                    <div className="mw-qup-pricing-row">
                      <span>Shipping</span>
                      <span>{(quote as MultiFileQuotation).shippingEstimate!.toFixed(2)}</span>
                    </div>
                  )}
                  {(quote as MultiFileQuotation).taxEstimate != null && (
                    <div className="mw-qup-pricing-row">
                      <span>Tax</span>
                      <span>{(quote as MultiFileQuotation).taxEstimate!.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              {priorityShipping && (
                <div className="mw-qup-pricing-row is-fee">
                  <span>Priority shipping</span>
                  <span>+{PRIORITY_SHIPPING_FEE_EGP.toFixed(2)}</span>
                </div>
              )}
              <div className="mw-qup-pricing-divider" />
              <div className="mw-qup-pricing-row is-total">
                <span>Estimated total</span>
                <span className="mw-qup-pricing-total-value">
                  <PriceTransition status={priceStatus} value={displayTotal ?? undefined} calculatingLabel="..." errorLabel="Error" />
                </span>
              </div>
              <PriceEstimateNotice />
            </div>
          ) : (
            <div className="mw-qup-checkout-status">
              <Icon name={isCalculatingQuote ? 'loader' : 'configure'} size={12} />
              {isCalculatingQuote ? 'Calculating pricing…' : 'Pricing updates once parts are uploaded and configuration is set.'}
            </div>
          )}

          {/* Shipping */}
          {orderReady && (
            <div className="mw-qup-priority">
              <div className="mw-qup-priority-row">
                <span className="mw-qup-priority-icon" aria-hidden="true"><Icon name="send" size={14} /></span>
                <div className="mw-qup-priority-text">
                  <span className="mw-qup-priority-title">Priority shipping</span>
                  <span className="mw-qup-priority-sub">Selected in your delivery details</span>
                </div>
                <button
                  type="button"
                  className={`mw-toggle ${priorityShipping ? 'is-on' : ''}`}
                  role="switch"
                  aria-checked={priorityShipping}
                  aria-label="Priority shipping"
                  onClick={() => onPriorityShippingChange(!priorityShipping)}
                >
                  <span className="mw-toggle-thumb" />
                </button>
              </div>
              <div className="mw-qup-priority-note" role="note">
                {priorityShipping
                  ? `Priority shipping is enabled. An additional ${PRIORITY_SHIPPING_FEE_EGP} EGP has been added.`
                  : `Activating priority shipping will add ${PRIORITY_SHIPPING_FEE_EGP} EGP to the total price.`}
              </div>
            </div>
          )}
        </div>
      </PanelShell>

      {/* Right Panel 3 — Checkout */}
      <PanelShell
        icon="shieldCheck"
        title="Checkout"
        subtitle="Submit your manufacturing request"
        className="mw-panel-quote-checkout"
      >
        <div className="mw-qup-body">
          {orderReady && authGateOpen && !isAuthenticated && (
            <div className="mw-qup-auth-gate">
              <div>
                <div className="mw-qup-auth-gate-text">Sign in to submit</div>
                <div className="mw-qup-auth-gate-sub">Create an order with your account</div>
              </div>
              <div className="mw-qup-auth-gate-actions">
                <button className="mw-btn mw-btn-secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={onSignIn}>Sign In</button>
                <button className="mw-btn mw-btn-primary" style={{ width: 'auto', padding: '8px 14px' }} onClick={onRegister}>Register</button>
              </div>
            </div>
          )}

          <button className="mw-btn mw-btn-primary mw-qup-confirm" onClick={onSubmit} disabled={isSubmitting || !canSubmitFinal(quote, isCalculatingQuote, quoteFailed, request, usableUploadItems)}>
            {isSubmitting ? <><span className="mw-spinner" /> Submitting...</> : <><Icon name="check" size={14} /> Confirm &amp; Pay</>}
          </button>

          {manualQuoteVisible && (
            <button className="mw-btn mw-btn-secondary mw-qup-manual" onClick={onSubmit} disabled={isSubmitting}>
              <Icon name="file" size={14} /> Request Manual Quote
            </button>
          )}
          <div className="mw-qup-secure" aria-hidden="true">
            <Icon name="shieldCheck" size={11} /> Secure and encrypted checkout
          </div>

          {!canSubmitFinal(quote, isCalculatingQuote, quoteFailed, request, usableUploadItems) && !manualQuoteVisible && (
            <div className="mw-qup-checkout-status">
              <Icon name="configure" size={12} /> Complete technology, process, material and upload, then set configuration to enable checkout.
            </div>
          )}
        </div>
      </PanelShell>
    </>
  );
};