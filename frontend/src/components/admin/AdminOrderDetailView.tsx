import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { ApiService } from '../../services/api';

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
    return <AdminLayout title={t('admin.orderDetail.title')}><div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.orderDetail.noSelected')}</div></AdminLayout>;
  }

  return (
    <AdminLayout title={`${t('admin.orderDetail.title')} · ${selectedAdminOrderId}`} subtitle={t('admin.orderDetail.subtitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--cam-text-muted)' }}>{t('admin.orderDetail.loading')}</div>
      ) : !order ? (
        <div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.orderDetail.notFound')}</div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-outline" onClick={() => { closeAdminDetail(); setActiveView('admin-orders'); }}>
              {t('admin.orderDetail.backToOrders')}
            </button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-primary" onClick={approveOrder} disabled={approving || !canApprove} title={canApprove ? t('admin.orderDetail.approveTooltip') : t('admin.orderDetail.noApprove')}>
                {approving ? t('admin.approving') : t('admin.orderDetail.approveOrder')}
              </button>
              <span className="badge badge-primary">{order.status}</span>
              <span className="badge badge-neutral">{order.paymentStatus}</span>
              <span className="badge badge-neutral">{order.manufacturingStatus}</span>
              <span className="badge badge-neutral">{order.shippingStatus}</span>
            </div>
          </div>

          <div className="dashboard-section-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-secondary)' }}>{t('admin.orderDetail.orderHeader')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <DetailItem label={t('admin.orderDetail.orderId')} value={order.id} />
              <DetailItem label={t('admin.orderDetail.customer')} value={order.user?.name || '—'} />
              <DetailItem label={t('admin.orderDetail.created')} value={new Date(order.createdAt).toLocaleString()} />
              <DetailItem label={t('admin.orderDetail.updated')} value={new Date(order.updatedAt).toLocaleString()} />
              <DetailItem label={t('admin.orderDetail.totalPrice')} value={order.totalCost} />
              <DetailItem label={t('admin.orderDetail.currency')} value="EGP" />
              <DetailItem label={t('admin.orderDetail.assignedManufacturer')} value={order.manufacturer?.companyName || t('admin.orderDetail.unassigned')} />
            </div>
          </div>

          <div className="dashboard-section-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-secondary)' }}>{t('admin.orderDetail.customerSection')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <DetailItem label={t('admin.orderDetail.name')} value={order.user?.name || '—'} />
              <DetailItem label={t('admin.orderDetail.email')} value={order.user?.email || '—'} />
              <DetailItem label={t('admin.orderDetail.phone')} value={order.user?.phone || '—'} />
              <DetailItem label={t('admin.orderDetail.customerId')} value={order.user?.id || '—'} />
              <DetailItem label={t('admin.orderDetail.accountStatus')} value={order.user?.accountStatus || '—'} />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--cam-text-muted)', marginBottom: '6px' }}>{t('admin.orderDetail.profile')}</div>
                <button className="btn btn-sm btn-outline" onClick={() => { if (order.user?.id) openAdminCustomerDetail(order.user.id); }}>
                  {t('admin.orderDetail.openCustomerProfile')}
                </button>
              </div>
            </div>
          </div>

          <div className="dashboard-section-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-secondary)' }}>{t('admin.orderDetail.cadInformation')}</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {(order.cadFiles || []).map((entry: any) => (
                <div key={entry.cadFileId} style={{ padding: '14px', background: 'var(--cam-surface-2)', borderRadius: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <DetailItem label={t('admin.orderDetail.fileName')} value={entry.cadFile?.name || '—'} />
                    <DetailItem label={t('admin.orderDetail.fileType')} value={entry.cadFile?.format || '—'} />
                    <DetailItem label={t('admin.orderDetail.size')} value={entry.cadFile?.size || '—'} />
                    <DetailItem label={t('admin.orderDetail.status')} value={entry.cadFile?.status || '—'} />
                    <DetailItem label={t('admin.orderDetail.dimensions')} value={entry.cadFile?.dimensions || '—'} />
                    <DetailItem label={t('admin.orderDetail.volume')} value={entry.cadFile?.volume || '—'} />
                  </div>
                  {entry.configuration && <pre style={{ marginTop: '10px', color: 'var(--cam-text-muted)', whiteSpace: 'pre-wrap' }}>{JSON.stringify(entry.configuration, null, 2)}</pre>}
                </div>
              ))}
              {(order.cadFiles || []).length === 0 && <div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.orderDetail.noCadFiles')}</div>}
            </div>
          </div>

          <div className="dashboard-section-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-secondary)' }}>{t('admin.orderDetail.configuration')}</h3>
            <pre style={{ color: 'var(--cam-text-secondary)', whiteSpace: 'pre-wrap' }}>{JSON.stringify({
              technology: order.technology,
              material: order.material,
              quantity: order.quantity,
              tolerance: order.tolerance,
              shippingMethod: order.shippingMethod,
              shippingAddress: order.shippingAddress,
              provider: order.provider,
            }, null, 2)}</pre>
          </div>

          <div className="dashboard-section-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-secondary)' }}>{t('admin.orderDetail.pricing')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <DetailItem label={t('admin.orderDetail.materialCost')} value={order.manufacturingCost || '—'} />
              <DetailItem label={t('admin.orderDetail.machineCost')} value={order.serviceFee || '—'} />
              <DetailItem label={t('admin.orderDetail.finalPrice')} value={order.totalCost} />
              <DetailItem label={t('admin.orderDetail.pricingVersion')} value={order.pricingEquationVersion ? `v${order.pricingEquationVersion.version}` : '—'} />
              <DetailItem label={t('admin.orderDetail.equationName')} value={order.pricingEquationVersion?.name || '—'} />
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-sm btn-outline" onClick={() => { setEditPriceOpen((open) => !open); setNewPrice(''); setPriceReason(''); }}>
                {editPriceOpen ? t('admin.orderDetail.cancelPriceEdit') : t('admin.orderDetail.editPrice')}
              </button>
              {editPriceOpen && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end', background: 'var(--cam-surface-2)', padding: '14px', borderRadius: '8px', width: '100%' }}>
                  <div style={{ minWidth: '200px', flex: 1 }}>
                    <label style={{ display: 'block', color: 'var(--cam-text-muted)', fontSize: '12px', marginBottom: '6px' }}>{t('admin.orderDetail.newPrice')}</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0.00" style={{ width: '100%' }} />
                  </div>
                  <div style={{ minWidth: '240px', flex: 2 }}>
                    <label style={{ display: 'block', color: 'var(--cam-text-muted)', fontSize: '12px', marginBottom: '6px' }}>{t('admin.orderDetail.priceReason')}</label>
                    <input className="form-control" value={priceReason} onChange={(e) => setPriceReason(e.target.value)} placeholder={t('admin.orderDetail.priceReasonPlaceholder')} style={{ width: '100%' }} />
                  </div>
                  <button className="btn btn-primary" onClick={updatePrice} disabled={savingPrice}>{savingPrice ? t('admin.saving') : t('admin.orderDetail.applyPrice')}</button>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-section-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-secondary)' }}>{t('admin.orderDetail.manufacturing')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <DetailItem label={t('admin.orderDetail.manufacturingStatus')} value={order.manufacturingStatus} />
              <DetailItem label={t('admin.orderDetail.shippingStatus')} value={order.shippingStatus} />
              <DetailItem label={t('admin.orderDetail.paymentStatus')} value={order.paymentStatus} />
              <DetailItem label={t('admin.orderDetail.requiredManufacturer')} value={order.manufacturer?.companyName || t('admin.orderDetail.unassigned')} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ minWidth: '280px', flex: 1 }}>
                <label style={{ display: 'block', color: 'var(--cam-text-muted)', fontSize: '12px', marginBottom: '6px' }}>{t('admin.orderDetail.assignReassignManufacturer')}</label>
                <select className="form-control" value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">{t('admin.selectManufacturer')}</option>
                  {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.companyName} — {m.availability}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={assignManufacturer} disabled={!manufacturerId || saving}>
                {saving ? t('admin.saving') : t('admin.saveAssignment')}
              </button>
            </div>
          </div>

          <div className="dashboard-section-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-secondary)' }}>{t('admin.orderDetail.timeline')}</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {timeline.map((event: any) => (
                <div key={event.id} style={{ padding: '12px', borderLeft: '2px solid #0066FF', background: 'var(--cam-surface-2)' }}>
                  <div style={{ color: 'var(--cam-text-secondary)', fontWeight: 600 }}>{event.eventType}</div>
                  <div style={{ color: 'var(--cam-text-muted)', fontSize: '13px' }}>{event.description}</div>
                  <div style={{ color: 'var(--cam-text-muted)', fontSize: '12px' }}>{new Date(event.createdAt).toLocaleString()}</div>
                </div>
              ))}
              {timeline.length === 0 && <div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.orderDetail.noTimelineEvents')}</div>}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: '11px', color: 'var(--cam-text-muted)', marginBottom: '6px' }}>{label}</div>
    <div style={{ color: 'var(--cam-text-secondary)', wordBreak: 'break-word' }}>{value || '—'}</div>
  </div>
);
