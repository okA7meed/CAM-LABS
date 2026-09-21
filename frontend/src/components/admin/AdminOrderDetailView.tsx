import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from './AdminLayout';
import { EmptyState } from './ui/States';
import { ApiService } from '../../services/api';
import { CadFile } from '../../types';
import { OrderHeader } from './order-detail/OrderHeader';
import { OrderSummaryStrip } from './order-detail/OrderSummaryStrip';
import { CadItemsSection } from './order-detail/CadItemsSection';
import { CadViewerDialog } from './order-detail/CadViewerDialog';
import { ConfigCard, TechNotesDocsCard, TimelineCard } from './order-detail/SupportCards';
import { CustomerCard, ManufacturingCard, OrderStatusCard, PricingCard } from './order-detail/SidebarCards';
import { EditPriceDialog, MessageCustomerDialog } from './order-detail/dialogs';
import { generateOrderPdf } from './order-detail/pdf';
import { AdminOrderCadEntry, AdminOrderEvent, toViewerFile } from './order-detail/types';
import { Icon } from '../ui/Icon';

export const AdminOrderDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAdminOrderId, closeAdminDetail, setActiveView, showToast, openAdminCustomerDetail } = useStore();
  const { currentUser } = useAuth();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [manufacturers, setManufacturers] = useState<Array<{ id: string; companyName: string; availability?: string }>>([]);
  const [manufacturerId, setManufacturerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [downloadAllBusy, setDownloadAllBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedAdminOrderId) return;
    setLoading(true);
    try {
      const [orderRes, manufacturersRes] = await Promise.all([
        fetch(`/api/v1/admin/orders/${selectedAdminOrderId}`, { credentials: 'same-origin' }),
        fetch('/api/v1/admin/manufacturers?limit=200', { credentials: 'same-origin' }),
      ]);
      if (!orderRes.ok) throw new Error('Failed to load order');
      if (!manufacturersRes.ok) throw new Error('Failed to load manufacturers');
      const orderJson = await orderRes.json();
      const manufacturersJson = await manufacturersRes.json();
      const data = orderJson.data as Record<string, unknown>;
      setOrder(data);
      setManufacturers(manufacturersJson.data.manufacturers || []);
      setManufacturerId((data?.manufacturerId as string) || '');
    } catch (err: unknown) {
      showToast('Error', err instanceof Error ? err.message : 'Failed to load order details', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedAdminOrderId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const entries: AdminOrderCadEntry[] = useMemo(
    () => (Array.isArray(order?.cadFiles) ? (order?.cadFiles as AdminOrderCadEntry[]) : []),
    [order],
  );
  const events: AdminOrderEvent[] = useMemo(
    () => (Array.isArray(order?.events) ? (order?.events as AdminOrderEvent[]) : []),
    [order],
  );
  const files: CadFile[] = useMemo(() => {
    const mapped: CadFile[] = [];
    for (const entry of entries) {
      const file = toViewerFile(entry);
      if (file) mapped.push(file);
    }
    return mapped;
  }, [entries]);

  const user = (order?.user || {}) as { id?: string; name?: string; email?: string; phone?: string; accountStatus?: string };
  const manufacturer = (order?.manufacturer || {}) as { companyName?: string };
  const pricingVersion = order?.pricingEquationVersion as { version?: number; name?: string } | null;

  const cadBadge = useMemo(() => {
    if (entries.length === 0) return { label: String(order?.status || 'No CAD files'), tone: 'unknown' as const };
    const statuses = entries.map((e) => e.cadFile?.status || '');
    if (statuses.every((s) => s === 'Verified CAD')) return { label: 'Verified CAD', tone: 'delivered' as const };
    if (statuses.some((s) => s === 'DFM Flagged')) return { label: 'DFM Flagged', tone: 'review' as const };
    if (statuses.some((s) => s === 'Analyzing')) return { label: 'Analyzing CAD', tone: 'review' as const };
    return { label: statuses[0] || String(order?.status || 'CAD'), tone: 'unknown' as const };
  }, [entries, order?.status]);

  const goBack = useCallback(() => {
    closeAdminDetail();
    setActiveView('admin-orders');
  }, [closeAdminDetail, setActiveView]);

  const assignManufacturer = async () => {
    if (!selectedAdminOrderId || !manufacturerId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${selectedAdminOrderId}/assign-manufacturer`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturerId }),
      });
      if (!res.ok) throw new Error('Failed to assign manufacturer');
      showToast('Saved', 'Manufacturer assignment updated.', 'success');
      await load();
    } catch (err: unknown) {
      showToast('Error', err instanceof Error ? err.message : 'Failed to assign manufacturer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const approveOrder = async () => {
    if (!selectedAdminOrderId) return;
    setApproving(true);
    try {
      await ApiService.adminApproveOrder(selectedAdminOrderId);
      showToast(t('admin.orderDetail.approveSuccessTitle'), t('admin.orderDetail.approveSuccess'), 'success');
      await load();
    } catch (err: unknown) {
      showToast('Error', err instanceof Error ? err.message : t('admin.orderDetail.approveFailed'), 'error');
    } finally {
      setApproving(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (!selectedAdminOrderId) return;
    setStatusBusy(true);
    try {
      await ApiService.adminUpdateOrderStatus(selectedAdminOrderId, status);
      showToast('Status updated', `Order moved to ${status}.`, 'success');
      await load();
    } catch (err: unknown) {
      showToast('Error', err instanceof Error ? err.message : 'Order status could not be updated.', 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!selectedAdminOrderId) return;
    setMessageSending(true);
    setMessageError(null);
    try {
      await ApiService.adminSendCustomerMessage(selectedAdminOrderId, message);
      showToast('Message sent', 'Your message was recorded in the order history.', 'success');
      setMessageOpen(false);
      await load();
    } catch (err: unknown) {
      setMessageError(err instanceof Error ? err.message : 'Message could not be sent.');
    } finally {
      setMessageSending(false);
    }
  };

  const savePrice = async (price: number, reason: string) => {
    if (!selectedAdminOrderId) return;
    setPriceSaving(true);
    setPriceError(null);
    try {
      await ApiService.adminUpdateOrderPrice(selectedAdminOrderId, price, reason || undefined);
      showToast(t('admin.orderDetail.priceSuccessTitle'), t('admin.orderDetail.priceSuccess'), 'success');
      setPriceOpen(false);
      await load();
    } catch (err: unknown) {
      setPriceError(err instanceof Error ? err.message : t('admin.orderDetail.priceFailed'));
    } finally {
      setPriceSaving(false);
    }
  };

  const downloadFile = useCallback(
    async (file: CadFile) => {
      try {
        const res = await fetch(ApiService.getCadDownloadUrl(file.id), { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name || 'cad-file';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (err: unknown) {
        showToast('Error', err instanceof Error ? err.message : `Could not download ${file.name}.`, 'error');
      }
    },
    [showToast],
  );

  const downloadAll = useCallback(async () => {
    if (files.length === 0 || downloadAllBusy) return;
    setDownloadAllBusy(true);
    let failed = 0;
    for (const file of files) {
      try {
        const res = await fetch(ApiService.getCadDownloadUrl(file.id), { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name || 'cad-file';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        // Small pause keeps the browser download shelf reliable for multi-file orders.
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      } catch {
        failed += 1;
      }
    }
    setDownloadAllBusy(false);
    if (failed === 0) showToast('Downloads started', `${files.length} CAD file${files.length === 1 ? '' : 's'} downloading.`, 'success');
    else showToast('Partial download', `${failed} of ${files.length} files could not be downloaded.`, 'error');
  }, [files, downloadAllBusy, showToast]);

  const downloadPdf = useCallback(() => {
    if (!order || pdfBusy) return;
    setPdfBusy(true);
    try {
      const opened = generateOrderPdf(order);
      if (!opened) showToast('Popup blocked', 'Allow popups to generate the order PDF.', 'error');
    } catch (err: unknown) {
      showToast('Error', err instanceof Error ? err.message : 'Order PDF could not be generated.', 'error');
    } finally {
      window.setTimeout(() => setPdfBusy(false), 600);
    }
  }, [order, pdfBusy, showToast]);

  if (!selectedAdminOrderId) {
    return (
      <AdminLayout title={t('admin.orderDetail.title')}>
        <div className="admin-section">
          <EmptyState icon="cube" text={t('admin.orderDetail.noSelected')} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`${t('admin.orderDetail.title')} · ${typeof order?.reference === 'string' && order.reference ? order.reference : selectedAdminOrderId}`} subtitle={t('admin.orderDetail.subtitle')}>
      <div className="od-page">
        {loading ? (
          <div className="od-state" role="status">
            <Icon name="loader" size={22} className="admin-spin" />
            {t('admin.orderDetail.loading')}
          </div>
        ) : !order ? (
          <EmptyState icon="cube" text={t('admin.orderDetail.notFound')} />
        ) : (
          <>
            <OrderHeader
              orderId={String((order as any)?.reference || order.id)}
              cadBadge={cadBadge.label}
              cadBadgeTone={cadBadge.tone}
              createdAt={order.createdAt as string}
              status={String(order.status)}
              onBack={goBack}
              onDownloadPdf={downloadPdf}
              pdfBusy={pdfBusy}
              onMessage={() => {
                setMessageError(null);
                setMessageOpen(true);
              }}
              onApprove={() => void approveOrder()}
              approveBusy={approving}
              onStatusChange={(status) => void changeStatus(status)}
              statusBusy={statusBusy || approving}
            />

            <OrderSummaryStrip
              orderId={String((order as any)?.reference || order.id)}
              customerName={user.name || ''}
              customerEmail={user.email || ''}
              createdAt={order.createdAt as string}
              totalCost={order.totalCost as string}
              onCopied={(message) => showToast('Copied', message, 'success')}
            />

            <div className="od-grid">
              <div className="od-main">
                <CadItemsSection
                  entries={entries}
                  files={files}
                  onOpenViewer={(id) => setViewerId(id)}
                  onOpenViewerAll={() => {
                    if (files[0]) setViewerId(files[0].id);
                  }}
                  onDownload={(file) => void downloadFile(file)}
                  onDownloadAll={() => void downloadAll()}
                  downloadAllBusy={downloadAllBusy}
                />
                <div className="od-support-row">
                  <TechNotesDocsCard
                    notes={order.technicalNotes as string}
                    documents={((order.technicalDocuments as Array<{ id: string; name: string; mimeType?: string; byteSize?: number; scanStatus?: string }>) || [])}
                  />
                  <ConfigCard order={order} />
                  <TimelineCard events={events} />
                </div>
              </div>
              <div className="od-side">
                <OrderStatusCard status={String(order.status)} createdAt={order.createdAt as string} events={events} />
                <CustomerCard
                  name={user.name}
                  email={user.email}
                  customerId={user.id}
                  onViewProfile={() => {
                    if (user.id) openAdminCustomerDetail(user.id);
                  }}
                  onCopied={(message) => showToast('Copied', message, 'success')}
                />
                <PricingCard
                  materialCost={order.manufacturingCost as string}
                  machineCost={order.serviceFee as string}
                  totalCost={order.totalCost as string}
                  pricingVersion={pricingVersion && typeof pricingVersion.version === 'number' ? `v${pricingVersion.version}` : null}
                  equationName={pricingVersion?.name || null}
                  events={events}
                  role={currentUser?.role}
                  onEdit={() => {
                    setPriceError(null);
                    setPriceOpen(true);
                  }}
                />
                <ManufacturingCard
                  manufacturingStatus={order.manufacturingStatus as string}
                  shippingStatus={order.shippingStatus as string}
                  paymentStatus={order.paymentStatus as string}
                  requiredManufacturer={manufacturer.companyName}
                  manufacturers={manufacturers}
                  manufacturerId={manufacturerId}
                  onSelect={setManufacturerId}
                  onSave={() => void assignManufacturer()}
                  saving={saving}
                />
              </div>
            </div>

            <CadViewerDialog
              files={files}
              activeId={viewerId}
              onSelect={(id) => setViewerId(id)}
              onClose={() => setViewerId(null)}
              onDownload={(file) => void downloadFile(file)}
            />
            <MessageCustomerDialog
              open={messageOpen}
              customerName={user.name}
              customerEmail={user.email}
              orderId={String((order as any)?.reference || order.id)}
              sending={messageSending}
              error={messageError}
              onClose={() => {
                if (!messageSending) setMessageOpen(false);
              }}
              onSend={(message) => void sendMessage(message)}
            />
            <EditPriceDialog
              open={priceOpen}
              currentPrice={order.totalCost as string}
              currency={(order.totalCost as string)?.match(/[A-Z]{3}/)?.[0] || 'EGP'}
              saving={priceSaving}
              error={priceError}
              onClose={() => {
                if (!priceSaving) setPriceOpen(false);
              }}
              onSave={(price, reason) => void savePrice(price, reason)}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
};
