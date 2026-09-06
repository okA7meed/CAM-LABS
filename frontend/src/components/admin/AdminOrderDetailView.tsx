import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardHeader, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { DetailsGrid, DetailItem } from './ui/DetailItem';
import { EmptyState } from './ui/States';
import { StatusBadge, StatusTone, statusToneOf } from './ui/StatusBadge';
import { ApiService } from '../../services/api';

const ACCOUNT_TONES: Record<string, StatusTone> = {
  ACTIVE: 'delivered',
  DISABLED: 'unknown',
  SUSPENDED: 'cancelled',
};

const ORDER_TONES: Record<string, StatusTone> = {
  'In Review': 'review',
  'In Production': 'production',
  'Ready for Approval': 'review',
  'Quality Inspection': 'inspection',
  'Delivered': 'delivered',
  'Completed': 'delivered',
  'Cancelled': 'cancelled',
  'Approved': 'delivered',
  'Pending': 'review',
};

const PAYMENT_TONES: Record<string, StatusTone> = {
  'Pending': 'review',
  'Paid': 'delivered',
  'Refunded': 'inspection',
  'Partially Refunded': 'inspection',
  'Failed': 'cancelled',
};

export const AdminOrderDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAdminOrderId, closeAdminDetail, setActiveView, showToast, openAdminCustomerDetail } = useStore();
  const [order, setOrder] = useState<any>(null);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [manufacturerId, setManufacturerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [priceReason, setPriceReason] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  const load = async () => {
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
      setOrder(orderJson.data);
      setManufacturers(manufacturersJson.data.manufacturers || []);
      setManufacturerId(orderJson.data?.manufacturerId || '');
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load order details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedAdminOrderId]);

  const accountStatusLabel = (value: string): string => {
    switch (value) {
      case 'ACTIVE': return t('admin.status.active');
      case 'DISABLED': return t('admin.status.disabled');
      case 'SUSPENDED': return t('admin.status.suspended');
      default: return value;
    }
  };

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
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to assign manufacturer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const timeline = useMemo(() => order?.events || [], [order]);

  const approveOrder = async () => {
    if (!selectedAdminOrderId) return;
    setApproving(true);
    try {
      await ApiService.adminApproveOrder(selectedAdminOrderId);
      showToast(t('admin.orderDetail.approveSuccessTitle'), t('admin.orderDetail.approveSuccess'), 'success');
      await load();
    } catch (err: any) {
      showToast('Error', err?.message || t('admin.orderDetail.approveFailed'), 'error');
    } finally {
      setApproving(false);
    }
  };

  const canApprove = order && !['Delivered', 'Cancelled', 'Quality Inspection'].includes(order.status);

  const updatePrice = async () => {
    if (!selectedAdminOrderId) return;
    const price = Number(newPrice);
    if (!Number.isFinite(price) || price <= 0) {
      showToast('Error', t('admin.orderDetail.invalidPrice'), 'error');
      return;
    }
    setSavingPrice(true);
    try {
      await ApiService.adminUpdateOrderPrice(selectedAdminOrderId, price, priceReason || undefined);
      showToast(t('admin.orderDetail.priceSuccessTitle'), t('admin.orderDetail.priceSuccess'), 'success');
      setEditPriceOpen(false);
      setNewPrice('');
      setPriceReason('');
      await load();
    } catch (err: any) {
      showToast('Error', err?.message || t('admin.orderDetail.priceFailed'), 'error');
    } finally {
      setSavingPrice(false);
    }
  };

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
    <AdminLayout title={`${t('admin.orderDetail.title')} · ${selectedAdminOrderId}`} subtitle={t('admin.orderDetail.subtitle')}>
      <div className="admin-section">
        {loading ? (
          <div className="admin-muted" style={{ textAlign: 'center', padding: '60px 0' }}>{t('admin.orderDetail.loading')}</div>
        ) : !order ? (
          <EmptyState icon="cube" text={t('admin.orderDetail.notFound')} />
        ) : (
          <>
            <AdminCard>
              <AdminCardHeader
                title={order.id}
                description={order.partName || order.technology}
                actions={
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      icon="check"
                      onClick={() => void approveOrder()}
                      disabled={approving || !canApprove}
                      title={canApprove ? t('admin.orderDetail.approveTooltip') : t('admin.orderDetail.noApprove')}
                    >
                      {approving ? t('admin.approving') : t('admin.orderDetail.approveOrder')}
                    </Button>
                    <Button variant="outline" size="sm" icon="arrowLeft" onClick={() => { closeAdminDetail(); setActiveView('admin-orders'); }}>
                      {t('admin.orderDetail.backToOrders')}
                    </Button>
                  </>
                }
              />
              <AdminCardBody>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  <StatusBadge status={order.status} tone={ORDER_TONES[order.status] ?? statusToneOf(order.status)} />
                  <StatusBadge status={order.paymentStatus} tone={PAYMENT_TONES[order.paymentStatus] ?? statusToneOf(order.paymentStatus)} />
                  <StatusBadge status={order.manufacturingStatus} tone={statusToneOf(order.manufacturingStatus)} />
                  <StatusBadge status={order.shippingStatus} tone={statusToneOf(order.shippingStatus)} />
                </div>
                <DetailsGrid>
                  <DetailItem label={t('admin.orderDetail.orderId')} value={order.id} />
                  <DetailItem label={t('admin.orderDetail.customer')} value={order.user?.name || '—'} />
                  <DetailItem label={t('admin.orderDetail.created')} value={new Date(order.createdAt).toLocaleString()} />
                  <DetailItem label={t('admin.orderDetail.updated')} value={new Date(order.updatedAt).toLocaleString()} />
                  <DetailItem label={t('admin.orderDetail.totalPrice')} value={order.totalCost} />
                  <DetailItem label={t('admin.orderDetail.currency')} value="EGP" />
                  <DetailItem label={t('admin.orderDetail.assignedManufacturer')} value={order.manufacturer?.companyName || t('admin.orderDetail.unassigned')} />
                </DetailsGrid>
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.orderDetail.customerSection')} />
              <AdminCardBody>
                <DetailsGrid>
                  <DetailItem label={t('admin.orderDetail.name')} value={order.user?.name || '—'} />
                  <DetailItem label={t('admin.orderDetail.email')} value={order.user?.email || '—'} />
                  <DetailItem label={t('admin.orderDetail.phone')} value={order.user?.phone || '—'} />
                  <DetailItem label={t('admin.orderDetail.customerId')} value={order.user?.id || '—'} />
                  <DetailItem
                    label={t('admin.orderDetail.accountStatus')}
                    value={order.user?.accountStatus
                      ? <StatusBadge status={accountStatusLabel(order.user.accountStatus)} tone={ACCOUNT_TONES[order.user.accountStatus] ?? 'unknown'} />
                      : '—'}
                  />
                  <DetailItem
                    label={t('admin.orderDetail.profile')}
                    value={
                      <Button
                        variant="outline"
                        size="sm"
                        icon="eye"
                        onClick={() => { if (order.user?.id) openAdminCustomerDetail(order.user.id); }}
                      >
                        {t('admin.orderDetail.openCustomerProfile')}
                      </Button>
                    }
                  />
                </DetailsGrid>
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.orderDetail.cadInformation')} />
              <AdminCardBody>
                <div className="admin-list">
                  {(order.cadFiles || []).map((entry: any) => (
                    <div key={entry.cadFileId} style={{ padding: 14, border: '1px solid var(--admin-border)', borderRadius: 10, background: 'var(--admin-card-2)' }}>
                      <DetailsGrid>
                        <DetailItem label={t('admin.orderDetail.fileName')} value={entry.cadFile?.name || '—'} />
                        <DetailItem label={t('admin.orderDetail.fileType')} value={entry.cadFile?.format || '—'} />
                        <DetailItem label={t('admin.orderDetail.size')} value={entry.cadFile?.size || '—'} />
                        <DetailItem label={t('admin.orderDetail.status')} value={<StatusBadge status={entry.cadFile?.status || '—'} tone={statusToneOf(entry.cadFile?.status ?? '')} />} />
                        <DetailItem label={t('admin.orderDetail.dimensions')} value={entry.cadFile?.dimensions || '—'} />
                        <DetailItem label={t('admin.orderDetail.volume')} value={entry.cadFile?.volume || '—'} />
                      </DetailsGrid>
                      {entry.configuration && <pre className="admin-muted" style={{ whiteSpace: 'pre-wrap', margin: '12px 0 0' }}>{JSON.stringify(entry.configuration, null, 2)}</pre>}
                    </div>
                  ))}
                  {(order.cadFiles || []).length === 0 && <EmptyState icon="file" text={t('admin.orderDetail.noCadFiles')} />}
                </div>
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.orderDetail.configuration')} />
              <AdminCardBody>
                <pre className="admin-muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify({
                  technology: order.technology,
                  material: order.material,
                  quantity: order.quantity,
                  tolerance: order.tolerance,
                  shippingMethod: order.shippingMethod,
                  shippingAddress: order.shippingAddress,
                  provider: order.provider,
                }, null, 2)}</pre>
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader
                title={t('admin.orderDetail.pricing')}
                actions={
                  <Button variant="outline" size="sm" onClick={() => { setEditPriceOpen((open) => !open); setNewPrice(''); setPriceReason(''); }}>
                    {editPriceOpen ? t('admin.orderDetail.cancelPriceEdit') : t('admin.orderDetail.editPrice')}
                  </Button>
                }
              />
              <AdminCardBody>
                <DetailsGrid>
                  <DetailItem label={t('admin.orderDetail.materialCost')} value={order.manufacturingCost || '—'} />
                  <DetailItem label={t('admin.orderDetail.machineCost')} value={order.serviceFee || '—'} />
                  <DetailItem label={t('admin.orderDetail.finalPrice')} value={order.totalCost} />
                  <DetailItem label={t('admin.orderDetail.pricingVersion')} value={order.pricingEquationVersion ? `v${order.pricingEquationVersion.version}` : '—'} />
                  <DetailItem label={t('admin.orderDetail.equationName')} value={order.pricingEquationVersion?.name || '—'} />
                </DetailsGrid>
                {editPriceOpen && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginTop: 16, padding: 14, border: '1px solid var(--admin-border)', borderRadius: 10, background: 'var(--admin-card-2)' }}>
                    <div style={{ minWidth: 200, flex: 1 }}>
                      <label className="admin-muted" style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>{t('admin.orderDetail.newPrice')}</label>
                      <input className="form-control" type="number" min="0" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0.00" style={{ width: '100%' }} />
                    </div>
                    <div style={{ minWidth: 240, flex: 2 }}>
                      <label className="admin-muted" style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>{t('admin.orderDetail.priceReason')}</label>
                      <input className="form-control" value={priceReason} onChange={(e) => setPriceReason(e.target.value)} placeholder={t('admin.orderDetail.priceReasonPlaceholder')} style={{ width: '100%' }} />
                    </div>
                    <Button variant="primary" onClick={() => void updatePrice()} disabled={savingPrice}>
                      {savingPrice ? t('admin.saving') : t('admin.orderDetail.applyPrice')}
                    </Button>
                  </div>
                )}
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.orderDetail.manufacturing')} />
              <AdminCardBody>
                <DetailsGrid>
                  <DetailItem label={t('admin.orderDetail.manufacturingStatus')} value={<StatusBadge status={order.manufacturingStatus || '—'} tone={statusToneOf(order.manufacturingStatus ?? '')} />} />
                  <DetailItem label={t('admin.orderDetail.shippingStatus')} value={<StatusBadge status={order.shippingStatus || '—'} tone={statusToneOf(order.shippingStatus ?? '')} />} />
                  <DetailItem label={t('admin.orderDetail.paymentStatus')} value={<StatusBadge status={order.paymentStatus || '—'} tone={PAYMENT_TONES[order.paymentStatus] ?? statusToneOf(order.paymentStatus ?? '')} />} />
                  <DetailItem label={t('admin.orderDetail.requiredManufacturer')} value={order.manufacturer?.companyName || t('admin.orderDetail.unassigned')} />
                </DetailsGrid>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginTop: 16 }}>
                  <div style={{ minWidth: 280, flex: 1 }}>
                    <label className="admin-muted" style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>{t('admin.orderDetail.assignReassignManufacturer')}</label>
                    <select className="form-control" value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} style={{ width: '100%' }}>
                      <option value="">{t('admin.selectManufacturer')}</option>
                      {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.companyName} — {m.availability}</option>)}
                    </select>
                  </div>
                  <Button variant="primary" onClick={() => void assignManufacturer()} disabled={!manufacturerId || saving}>
                    {saving ? t('admin.saving') : t('admin.saveAssignment')}
                  </Button>
                </div>
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.orderDetail.timeline')} />
              <AdminCardBody>
                <div className="admin-list">
                  {timeline.map((event: any) => (
                    <div key={event.id} style={{ padding: '12px 14px', borderLeft: '2px solid var(--admin-blue)', background: 'var(--admin-card-2)', borderRadius: 8 }}>
                      <div className="admin-card-title">{event.eventType}</div>
                      <div className="admin-muted" style={{ fontSize: 13, marginTop: 2 }}>{event.description}</div>
                      <div className="admin-muted" style={{ fontSize: 12, marginTop: 2 }}>{new Date(event.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                  {timeline.length === 0 && <EmptyState icon="clock" text={t('admin.orderDetail.noTimelineEvents')} />}
                </div>
              </AdminCardBody>
            </AdminCard>
          </>
        )}
      </div>
    </AdminLayout>
  );
};