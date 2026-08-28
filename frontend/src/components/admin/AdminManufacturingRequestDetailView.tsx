import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminManufacturingRequestDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAdminManufacturingRequestId, closeAdminDetail, setActiveView, showToast } = useStore();
  const [request, setRequest] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!selectedAdminManufacturingRequestId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/manufacturing-requests/${selectedAdminManufacturingRequestId}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load manufacturing request');
      const data = await res.json();
      setRequest(data.data);
      setStatus(data.data?.status || '');
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load request details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedAdminManufacturingRequestId]);

  const saveStatus = async () => {
    if (!selectedAdminManufacturingRequestId || !status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/manufacturing-requests/${selectedAdminManufacturingRequestId}/status`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      showToast('Saved', 'Manufacturing request status updated.', 'success');
      await load();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to update status', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedAdminManufacturingRequestId) {
    return <AdminLayout title={t('admin.mfgRequestDetail.title')}><div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.mfgRequestDetail.noSelected')}</div></AdminLayout>;
  }

  return (
    <AdminLayout title={`${t('admin.mfgRequestDetail.title')} · ${selectedAdminManufacturingRequestId}`} subtitle={t('admin.mfgRequestDetail.subtitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--cam-text-muted)' }}>{t('admin.mfgRequestDetail.loading')}</div>
      ) : !request ? (
        <div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.mfgRequestDetail.notFound')}</div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          <button className="btn btn-sm btn-outline" onClick={() => { closeAdminDetail(); setActiveView('admin-manufacturing-requests'); }}>
            {t('admin.mfgRequestDetail.backToRequests')}
          </button>

          <Section title={t('admin.mfgRequestDetail.requestDetails')}>
            <Grid>
              <DetailItem label={t('admin.mfgRequestDetail.requestId')} value={request.id} />
              <DetailItem label={t('admin.mfgRequestDetail.orderId')} value={request.orderId} />
              <DetailItem label={t('admin.mfgRequestDetail.manufacturer')} value={request.manufacturer?.companyName || '—'} />
              <DetailItem label={t('admin.mfgRequestDetail.technology')} value={request.technology} />
              <DetailItem label={t('admin.mfgRequestDetail.material')} value={request.material} />
              <DetailItem label={t('admin.mfgRequestDetail.quantity')} value={request.quantity} />
              <DetailItem label={t('admin.mfgRequestDetail.requiredDate')} value={request.requiredDate || '—'} />
              <DetailItem label={t('admin.mfgRequestDetail.created')} value={new Date(request.createdAt).toLocaleString()} />
              <DetailItem label={t('admin.mfgRequestDetail.accepted')} value={request.acceptedAt ? new Date(request.acceptedAt).toLocaleString() : '—'} />
              <DetailItem label={t('admin.mfgRequestDetail.started')} value={request.startedAt ? new Date(request.startedAt).toLocaleString() : '—'} />
              <DetailItem label={t('admin.mfgRequestDetail.completed')} value={request.completedAt ? new Date(request.completedAt).toLocaleString() : '—'} />
              <DetailItem label={t('admin.mfgRequestDetail.qaStatus')} value={request.order?.manufacturingStatus || '—'} />
            </Grid>
          </Section>

          <Section title={t('admin.mfgRequestDetail.currentStatus')}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ minWidth: '220px' }}>
                <label style={{ display: 'block', color: 'var(--cam-text-muted)', fontSize: '12px', marginBottom: '6px' }}>{t('admin.mfgRequestDetail.status')}</label>
                <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="PENDING">PENDING</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={saveStatus} disabled={saving}>
                {saving ? t('admin.saving') : t('admin.saveStatus')}
              </button>
            </div>
          </Section>

          <Section title={t('admin.mfgRequestDetail.orderSnapshot')}>
            <Grid>
              <DetailItem label={t('admin.mfgRequestDetail.orderStatus')} value={request.order?.status || '—'} />
              <DetailItem label={t('admin.mfgRequestDetail.customer')} value={request.order?.user?.name || '—'} />
              <DetailItem label={t('admin.mfgRequestDetail.assignedManufacturer')} value={request.order?.manufacturer?.companyName || '—'} />
              <DetailItem label={t('admin.mfgRequestDetail.pricingVersion')} value={request.order?.pricingEquationVersion ? `v${request.order.pricingEquationVersion.version}` : '—'} />
            </Grid>
          </Section>
        </div>
      )}
    </AdminLayout>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="dashboard-section-panel" style={{ padding: '20px' }}>
    <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-secondary)' }}>{title}</h3>
    {children}
  </div>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>{children}</div>
);

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: '11px', color: 'var(--cam-text-muted)', marginBottom: '6px' }}>{label}</div>
    <div style={{ color: 'var(--cam-text-secondary)' }}>{value || '—'}</div>
  </div>
);
