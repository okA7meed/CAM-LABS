import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from './AdminLayout';
import { EmptyState } from './ui/States';
import { ApiService } from '../../services/api';
import { CadFile } from '../../types';
import { toViewerFile } from './order-detail/types';
import { extractCurrency } from './order-detail/format';
import { CadViewerDialog } from './order-detail/CadViewerDialog';
import { QuoteHeader, QuoteMetaCard } from './quote-detail/QuoteHeader';
import { QuoteActions } from './quote-detail/QuoteActions';
import { QuoteSummaryCards } from './quote-detail/QuoteCards';
import {
  QuoteCustomerInfoCard,
  QuoteDeliveryCard,
  QuotePaymentCard,
  QuotePricingCard,
  QuoteShippingCard,
} from './quote-detail/QuoteInfoCards';
import { FilesSection } from './quote-detail/FilesSection';
import { QuoteAttachmentsCard, QuoteNotesCard, RawJsonCard } from './quote-detail/SupportCards';
import {
  QuoteConvertDialog,
  QuoteMessageDialog,
  QuoteNotesDialog,
  QuotePriceDialog,
  QuoteRejectDialog,
  QuoteStatusDialog,
} from './quote-detail/dialogs';
import { generateQuotePdf } from './quote-detail/pdf';
import { expiryInfoOf, formatQuoteDateTime, fmtEgp, fmtHours } from './quote-detail/format';
import { QuoteFileVM, QuoteMessageVM, businessReferenceOf, canMessageQuote, canMutateQuote, deliveryInfoOf, paymentLabelOf, quoteFilesOf, quotePricingOf, shippingInfoOf, summarizeSpec, totalPrintMinutes } from './quote-detail/types';
import { copyText } from './order-detail/format';
import { Icon } from '../ui/Icon';

type QuoteRecord = Record<string, unknown> & {
  id: string;
  status: string;
  totalPrice: string;
  technicalNotes?: string;
  convertedOrderId?: string | null;
  systemTotalPrice?: string | null;
  priceOverrideReason?: string | null;
  priceOverriddenBy?: string | null;
  priceOverriddenAt?: string | null;
  statusReason?: string | null;
};

type DeletionRequestRecord = {
  id: string;
  status: string;
  reason?: string | null;
  requestedAt?: string;
  reviewedAt?: string | null;
  adminNote?: string | null;
};

export const AdminQuoteDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAdminQuoteId, closeAdminDetail, setActiveView, showToast, openAdminOrderDetail, openAdminCustomerDetail } = useStore();
  const { currentUser } = useAuth();
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [cadById, setCadById] = useState<Map<string, CadFile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messages, setMessages] = useState<QuoteMessageVM[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertedOrderId, setConvertedOrderId] = useState<string | null>(null);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [deletionNote, setDeletionNote] = useState('');

  const load = useCallback(async () => {
    if (!selectedAdminQuoteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/quotes/${selectedAdminQuoteId}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load quote');
      const data = await res.json();
      const record = data.data as QuoteRecord;
      setQuote(record);

      const files = quoteFilesOf(record);
      const storedIds = Array.isArray(record.cadFileIds) ? (record.cadFileIds as unknown[]).map(String) : [];
      const ids = [...new Set([...storedIds, ...files.map((f) => f.fileId)])].filter((id) => id && !id.startsWith('file-'));
      const entries = await Promise.all(
        ids.map(async (id) => {
          const fetched = (await ApiService.getCadFile(id).catch(() => null)) as unknown as {
            id: string;
            name: string;
            format: string;
            size?: string;
            versions?: Array<{ id: string; version: number; scanStatus?: string; processingStatus?: string }>;
          } | null;
          if (!fetched?.id) return null;
          return toViewerFile({ cadFileId: fetched.id, cadFile: fetched });
        }),
      );
      const next = new Map<string, CadFile>();
      for (const file of entries) {
        if (file) next.set(file.id, file);
      }
      setCadById(next);
      setExpanded((prev) => {
        if (prev.size > 0) return prev;
        return files[0] ? new Set([files[0].fileId]) : new Set();
      });
    } catch (err: unknown) {
      showToast('Error', err instanceof Error ? err.message : 'Failed to load quote details', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedAdminQuoteId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const files: QuoteFileVM[] = useMemo(() => (quote ? quoteFilesOf(quote) : []), [quote]);
  const user = useMemo(() => ((quote?.user || {}) as { id?: string; name?: string; email?: string; phone?: string; accountStatus?: string }), [quote]);
  // ONE business reference for the whole lifecycle (internal RFQ id is routing-only).
  const reference = useMemo(() => businessReferenceOf(quote), [quote]);
  // ONE authoritative pricing derivation: Estimated = Subtotal + Shipping − Discount.
  const pricing = useMemo(() => (quote ? quotePricingOf(quote) : null), [quote]);
  const shipping = useMemo(() => (quote ? shippingInfoOf(quote) : null), [quote]);
  const delivery = useMemo(() => (quote ? deliveryInfoOf(quote) : null), [quote]);
  const paymentLabel = useMemo(() => paymentLabelOf((quote as any)?.preferredPaymentMethod), [quote]);
  // Per-part specs: a single value only when every priced file agrees.
  // Legacy/single-file quotes without a files breakdown fall back to the
  // header-level manufacturing fields.
  const technologySummary = useMemo(() => {
    const fromFiles = summarizeSpec(files.map((f) => f.process));
    if (fromFiles !== '—') return fromFiles;
    const header = String(quote?.technology || '').trim();
    return header || '—';
  }, [files, quote]);
  const materialSummary = useMemo(() => {
    const fromFiles = summarizeSpec(files.map((f) => f.material));
    if (fromFiles !== '—') return fromFiles;
    const header = String(quote?.material || '').trim();
    return header || '—';
  }, [files, quote]);
  // Headline commercial total: the agreed override when present, otherwise the
  // stored submission estimate — identical to the Pricing Summary figure.
  const headlineTotal = useMemo(() => {
    if (!quote || !pricing) return quote?.totalPrice || '—';
    if (Boolean(quote?.systemTotalPrice)) return quote.totalPrice;
    return fmtEgp(pricing.storedEstimated ?? pricing.estimated);
  }, [quote, pricing]);
  const expiry = useMemo(() => expiryInfoOf(typeof quote?.validUntil === 'string' ? quote.validUntil : null), [quote]);
  const isConverted = Boolean(quote?.convertedOrderId);
  const deletionRequests = useMemo(
    () => ((quote as unknown as { deletionRequests?: DeletionRequestRecord[] } | null)?.deletionRequests || []) as DeletionRequestRecord[],
    [quote],
  );
  const pendingDeletion = useMemo(() => deletionRequests.find((r) => r.status === 'PENDING') || null, [deletionRequests]);
  const viewerFiles = useMemo(() => [...cadById.values()], [cadById]);
  const canMutate = canMutateQuote(currentUser?.role);
  const canMessage = canMessageQuote(currentUser?.role);
  const manualOverride = Boolean(quote?.systemTotalPrice);
  const fileNames = useMemo(() => {
    if (files.length > 0) return files.map((f) => f.fileName);
    const fallback = String(quote?.partName || quote?.technology || '');
    return fallback ? [fallback] : [];
  }, [files, quote]);

  const goBack = useCallback(() => {
    closeAdminDetail();
    setActiveView('admin-quotes');
  }, [closeAdminDetail, setActiveView]);

  const copyReference = useCallback(async () => {
    try {
      const ok = await copyText(reference);
      showToast(ok ? 'Copied' : 'Error', ok ? 'Business reference copied.' : 'Could not copy reference.', ok ? 'success' : 'error');
    } catch {
      showToast('Error', 'Could not copy reference.', 'error');
    }
  }, [reference, showToast]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const downloadQuote = useCallback(() => {
    if (!quote || pdfBusy) return;
    setPdfBusy(true);
    try {
      const opened = generateQuotePdf(quote, files, user.name || 'Customer');
      if (!opened) showToast('Popup blocked', 'Allow popups to generate the quote PDF.', 'error');
    } catch (err: unknown) {
      showToast('Error', err instanceof Error ? err.message : 'Quote PDF could not be generated.', 'error');
    } finally {
      window.setTimeout(() => setPdfBusy(false), 600);
    }
  }, [quote, files, user.name, pdfBusy, showToast]);

  const downloadFile = useCallback(
    async (file: QuoteFileVM) => {
      try {
        const res = await fetch(ApiService.getCadDownloadUrl(file.fileId), { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.fileName || 'model-file';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (err: unknown) {
        showToast('Error', err instanceof Error ? err.message : `Could not download ${file.fileName}.`, 'error');
      }
    },
    [showToast],
  );

  const openMessages = useCallback(async () => {
    if (!selectedAdminQuoteId) return;
    setMessageError(null);
    setMessageOpen(true);
    setMessagesLoading(true);
    try {
      const list = await ApiService.adminGetQuoteMessages(selectedAdminQuoteId);
      if (list) setMessages(list);
    } catch (err: unknown) {
      showToast('Error', err instanceof Error ? err.message : 'Message history could not be loaded.', 'error');
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedAdminQuoteId, showToast]);

  const sendMessage = async (message: string, subject: string) => {
    if (!selectedAdminQuoteId) return;
    setMessageSending(true);
    setMessageError(null);
    try {
      await ApiService.adminSendCustomerMessage(selectedAdminQuoteId, message, subject || undefined);
      showToast('Message sent', 'Message sent successfully.', 'success');
      setMessageOpen(false);
    } catch (err: unknown) {
      setMessageError(err instanceof Error ? err.message : 'Message could not be sent.');
    } finally {
      setMessageSending(false);
    }
  };

  const changeStatus = async (status: string, reason: string) => {
    if (!selectedAdminQuoteId) return;
    setStatusBusy(true);
    setStatusError(null);
    setRejectError(null);
    try {
      await ApiService.adminUpdateQuoteStatus(selectedAdminQuoteId, status, reason || undefined);
      showToast('Status updated', status === 'Rejected' ? 'Quote rejected.' : `Quote status updated to ${status}.`, status === 'Rejected' ? 'info' : 'success');
      setStatusOpen(false);
      setRejectOpen(false);
      await refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Quote status could not be updated.';
      setStatusError(message);
      setRejectError(message);
    } finally {
      setStatusBusy(false);
    }
  };

  const saveNotes = async (technicalNotes: string) => {
    if (!selectedAdminQuoteId) return;
    setNotesSaving(true);
    setNotesError(null);
    try {
      await ApiService.adminUpdateQuoteNotes(selectedAdminQuoteId, technicalNotes);
      showToast('Quote updated', 'Technical notes saved.', 'success');
      setNotesOpen(false);
      await refresh();
    } catch (err: unknown) {
      setNotesError(err instanceof Error ? err.message : 'Quote notes could not be updated.');
    } finally {
      setNotesSaving(false);
    }
  };

  const savePrice = async (price: number, reason: string) => {
    if (!selectedAdminQuoteId) return;
    setPriceSaving(true);
    setPriceError(null);
    try {
      await ApiService.adminUpdateQuotePrice(selectedAdminQuoteId, price, reason);
      showToast('Price updated', 'Price updated successfully.', 'success');
      setPriceOpen(false);
      await refresh();
    } catch (err: unknown) {
      setPriceError(err instanceof Error ? err.message : 'Quote price could not be updated.');
    } finally {
      setPriceSaving(false);
    }
  };

  const reviewDeletion = async (decision: 'approve' | 'reject') => {
    if (!pendingDeletion || deletionBusy) return;
    setDeletionBusy(true);
    setDeletionError(null);
    try {
      if (decision === 'approve') {
        await ApiService.adminApproveDeletionRequest(pendingDeletion.id, deletionNote.trim() || undefined);
        showToast('Deletion approved', 'The quote was removed from active quotes.', 'success');
      } else {
        await ApiService.adminRejectDeletionRequest(pendingDeletion.id, deletionNote.trim() || undefined);
        showToast('Request rejected', 'The quote remains active.', 'info');
      }
      setDeletionNote('');
      await refresh();
    } catch (err: unknown) {
      setDeletionError(err instanceof Error ? err.message : 'The request could not be completed.');
    } finally {
      setDeletionBusy(false);
    }
  };

  const confirmConvert = async () => {
    if (!selectedAdminQuoteId) return;
    setConvertBusy(true);
    setConvertError(null);
    try {
      const order = await ApiService.adminConvertQuote(selectedAdminQuoteId);
      const id = (order as unknown as { id?: string } | null)?.id || null;
      if (!id) throw new Error('Conversion succeeded but no order was returned.');
      setConvertedOrderId(id);
      showToast('Quote converted', 'Quote converted to order.', 'success');
      await refresh();
    } catch (err: unknown) {
      setConvertError(err instanceof Error ? err.message : 'Quote could not be converted to an order.');
    } finally {
      setConvertBusy(false);
    }
  };

  if (!selectedAdminQuoteId) {
    return (
      <AdminLayout title={t('admin.quoteDetail.title')}>
        <div className="admin-section">
          <EmptyState icon="clipboard" text={t('admin.quoteDetail.noSelected')} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`${t('admin.quoteDetail.title')} · ${reference}`} subtitle={t('admin.quoteDetail.subtitle')}>
      <div className="qd-page">
        {loading ? (
          <div className="qd-state" role="status">
            <Icon name="loader" size={22} className="admin-spin" />
            {t('admin.quoteDetail.loading')}
          </div>
        ) : !quote ? (
          <EmptyState icon="clipboard" text={t('admin.quoteDetail.notFound')} />
        ) : (
          <>
            <QuoteHeader quoteId={quote.id} reference={reference} status={quote.status} fileNames={fileNames} onBack={goBack} onCopyReference={() => void copyReference()} />
            <QuoteMetaCard
              created={formatQuoteDateTime(quote.createdAt as string)}
              expiryLabel={expiry.label}
              expirySub={expiry.daysLeft === null ? null : expiry.expired ? '(Expired)' : `(${expiry.daysLeft} day${expiry.daysLeft === 1 ? '' : 's'} left)`}
              expiryExpired={expiry.expired}
              currency={extractCurrency(quote.totalPrice)}
              equationVersion={(quote.pricingEquationVersion as { version?: number } | null)?.version !== undefined ? `v${(quote.pricingEquationVersion as { version: number }).version}` : '—'}
            />
            <QuoteActions
              onDownload={downloadQuote}
              downloadBusy={pdfBusy}
              canMessage={canMessage}
              onMessage={() => void openMessages()}
              canMutate={canMutate}
              onStatus={() => {
                setStatusError(null);
                setStatusOpen(true);
              }}
              onReject={() => {
                setRejectError(null);
                setRejectOpen(true);
              }}
              onEdit={() => {
                setNotesError(null);
                setNotesOpen(true);
              }}
              onConvert={() => {
                setConvertError(null);
                setConvertedOrderId(null);
                setConvertOpen(true);
              }}
              convertBusy={convertBusy}
              converted={isConverted}
              statusBusy={statusBusy}
            />
            {isConverted && quote.convertedOrderId && (
              <button
                type="button"
                className="qd-link"
                onClick={() => openAdminOrderDetail(quote.convertedOrderId as string)}
              >
                Converted to order {reference} — view order →
              </button>
            )}
            {pendingDeletion && (
              <section className="admin-card qd-card qd-deletion-card" aria-label="Quote deletion request">
                <div className="admin-card-header">
                  <div className="qd-section-title">
                    <span className="qd-title-icon" aria-hidden="true">
                      <Icon name="trash" size={15} />
                    </span>
                    <h2 className="admin-card-title">Deletion Request — Pending Review</h2>
                  </div>
                </div>
                <div className="admin-card-body">
                  <p className="qd-deletion-meta">
                    Requested {pendingDeletion.requestedAt ? formatQuoteDateTime(pendingDeletion.requestedAt) : '—'}
                    {pendingDeletion.reason ? ` · Reason: ${pendingDeletion.reason}` : ''}
                  </p>
                  <p className="qd-deletion-hint">
                    Conversion to an order is blocked until this request is resolved. Approve the deletion to remove
                    the quote, or reject it to keep the quote active.
                  </p>
                  {deletionError && (
                    <p className="qd-error-text" role="alert">
                      {deletionError}
                    </p>
                  )}
                  {canMutate ? (
                    <div className="qd-deletion-actions">
                      <input
                        className="form-control"
                        value={deletionNote}
                        disabled={deletionBusy}
                        onChange={(e) => setDeletionNote(e.target.value)}
                        placeholder="Admin note (optional)"
                        aria-label="Admin note for deletion review"
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={deletionBusy}
                        onClick={() => void reviewDeletion('approve')}
                      >
                        <Icon name="check" size={14} />
                        {deletionBusy ? 'Working…' : 'Approve Delete'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={deletionBusy}
                        onClick={() => void reviewDeletion('reject')}
                      >
                        <Icon name="close" size={14} />
                        Reject Delete Request
                      </button>
                    </div>
                  ) : (
                    <p className="qd-deletion-hint">You do not have permission to review deletion requests.</p>
                  )}
                </div>
              </section>
            )}
            <QuoteSummaryCards
              totalPrice={headlineTotal}
              totalLabel={manualOverride ? 'Total Price' : 'Estimated Total'}
              manualOverride={manualOverride}
              fileCount={files.length}
              technology={technologySummary}
              material={materialSummary}
              quantity={typeof quote.quantity === 'number' ? quote.quantity : 0}
              printTime={fmtHours(totalPrintMinutes(files))}
              canMutate={canMutate && !isConverted}
              onEditPrice={() => {
                setPriceError(null);
                setPriceOpen(true);
              }}
            />
            <QuoteCustomerInfoCard
              name={user.name}
              email={user.email}
              phone={user.phone}
              accountStatus={user.accountStatus}
              onViewCustomer={user.id ? () => openAdminCustomerDetail(user.id as string) : null}
            />
            {pricing && shipping && delivery ? (
              <div className="qd-info-grid">
                <div className="qd-info-cell qd-span-delivery">
                  <QuoteDeliveryCard delivery={delivery} />
                </div>
                <div className="qd-info-cell qd-span-shipping">
                  <QuoteShippingCard shipping={shipping} />
                </div>
                <div className="qd-info-cell qd-span-payment">
                  <QuotePaymentCard methodLabel={paymentLabel} />
                </div>
                <div className="qd-info-cell qd-span-pricing">
                  <QuotePricingCard pricing={pricing} currentTotal={manualOverride ? quote.totalPrice : null} adjusted={manualOverride} />
                </div>
              </div>
            ) : null}
            <FilesSection
              files={files}
              cadById={cadById}
              expanded={expanded}
              onToggle={(fileId) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(fileId)) next.delete(fileId);
                  else next.add(fileId);
                  return next;
                })
              }
              onExpandAll={() => setExpanded(new Set(files.map((f) => f.fileId)))}
              onCollapseAll={() => setExpanded(new Set())}
              onPreview={(fileId) => {
                if (cadById.has(fileId)) setViewerId(fileId);
                else showToast('Preview unavailable', 'The 3D model for this file could not be resolved.', 'info');
              }}
              onDownload={(file) => void downloadFile(file)}
              onEditPrice={() => {
                setPriceError(null);
                setPriceOpen(true);
              }}
              canMutate={canMutate && !isConverted}
            />
            <div className="qd-notes-row">
              <QuoteNotesCard notes={quote.technicalNotes} />
              <QuoteAttachmentsCard
                documents={((quote.technicalDocuments as Array<{ id: string; name: string; mimeType?: string; byteSize?: number; scanStatus?: string }>) || [])}
              />
            </div>
            <RawJsonCard
              data={quote.pricingBreakdown || {}}
              onCopied={() => showToast('Copied', 'Pricing JSON copied.', 'success')}
              onCopyFailed={() => showToast('Error', 'Could not copy JSON.', 'error')}
            />

            <CadViewerDialog
              files={viewerFiles}
              activeId={viewerId}
              onSelect={(id) => setViewerId(id)}
              onClose={() => setViewerId(null)}
              onDownload={(file) => {
                const match = files.find((f) => f.fileId === file.id);
                if (match) void downloadFile(match);
              }}
            />
            <QuoteMessageDialog
              open={messageOpen}
              customerName={user.name}
              quoteId={reference}
              messages={messages}
              messagesLoading={messagesLoading}
              sending={messageSending}
              error={messageError}
              onClose={() => {
                if (!messageSending) setMessageOpen(false);
              }}
              onSend={(message, subject) => void sendMessage(message, subject)}
            />
            <QuoteStatusDialog
              open={statusOpen}
              currentStatus={quote.status}
              saving={statusBusy}
              error={statusError}
              onClose={() => {
                if (!statusBusy) setStatusOpen(false);
              }}
              onSave={(status, reason) => void changeStatus(status, reason)}
            />
            <QuoteRejectDialog
              open={rejectOpen}
              quoteId={reference}
              saving={statusBusy}
              error={rejectError}
              onClose={() => {
                if (!statusBusy) setRejectOpen(false);
              }}
              onConfirm={(reason) => void changeStatus('Rejected', reason)}
            />
            <QuoteNotesDialog
              open={notesOpen}
              initialNotes={quote.technicalNotes || ''}
              saving={notesSaving}
              error={notesError}
              onClose={() => {
                if (!notesSaving) setNotesOpen(false);
              }}
              onSave={(notes) => void saveNotes(notes)}
            />
            <QuotePriceDialog
              open={priceOpen}
              currentPrice={quote.totalPrice}
              systemPrice={quote.systemTotalPrice || null}
              currency={extractCurrency(quote.totalPrice)}
              overrideMeta={
                quote.priceOverrideReason
                  ? `Last override: ${quote.priceOverrideReason}${quote.priceOverriddenAt ? ` · ${formatQuoteDateTime(quote.priceOverriddenAt)}` : ''}`
                  : null
              }
              saving={priceSaving}
              error={priceError}
              onClose={() => {
                if (!priceSaving) setPriceOpen(false);
              }}
              onSave={(price, reason) => void savePrice(price, reason)}
            />
            <QuoteConvertDialog
              open={convertOpen}
              quoteId={reference}
              totalPrice={quote.totalPrice}
              converting={convertBusy}
              error={convertError}
              orderId={convertedOrderId}
              onClose={() => {
                if (!convertBusy) setConvertOpen(false);
              }}
              onConfirm={() => void confirmConvert()}
              onViewOrder={() => {
                setConvertOpen(false);
                if (convertedOrderId) openAdminOrderDetail(convertedOrderId);
              }}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
};
