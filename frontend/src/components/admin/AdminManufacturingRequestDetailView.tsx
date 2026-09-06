import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardBody, AdminCardHeader } from './ui/Card';
import { DetailsGrid, DetailItem } from './ui/DetailItem';
import { StatusBadge } from './ui/StatusBadge';
import { TechBadge } from './ui/TechBadge';
import { Button } from './ui/Button';

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

  const statusLabel = (value: string): string => {
    switch (value) {
      case 'PENDING': return t('admin.status.pending');
      case 'ACCEPTED': return t('admin.status.accepted');
      case 'IN_PROGRESS': return t('admin.status.inProgress');
      case 'COMPLETED': return t('admin.status.completed');
      case 'CANCELLED': return t('admin.status.cancelled');
      default: return value;
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
        <div className="admin-section">
          <AdminCard>
            <AdminCardHeader
              title={request.id}
              description={request.order?.partName || request.order?.id || '—'}
              actions={
                <Button variant="outline" size="sm" icon="arrowLeft" onClick={() => { closeAdminDetail(); setActiveView('admin-manufacturing-requests'); }}>
                  {t('admin.mfgRequestDetail.backToRequests')}
                </Button>
              }
            />
            <AdminCardBody>
              <DetailsGrid>
                <DetailItem label={t('admin.mfgRequestDetail.requestId')} value={request.id} />
                <DetailItem label={t('admin.mfgRequestDetail.orderId')} value={request.orderId || '—'} />
                <DetailItem label={t('admin.mfgRequestDetail.manufacturer')} value={request.manufacturer?.companyName || '—'} />
                <DetailItem label={t('admin.mfgRequestDetail.technology')} value={request.technology ? <TechBadge label={request.technology} /> : '—'} />
                <DetailItem label={t('admin.mfgRequestDetail.material')} value={request.material} />
                <DetailItem label={t('admin.mfgRequestDetail.quantity')} value={request.quantity} />
                <DetailItem label={t('admin.mfgRequestDetail.requiredDate')} value={request.requiredDate || '—'} />
                <DetailItem label={t('admin.mfgRequestDetail.created')} value={new Date(request.createdAt).toLocaleString()} />
                <DetailItem label={t('admin.mfgRequestDetail.accepted')} value={request.acceptedAt ? new Date(request.acceptedAt).toLocaleString() : '—'} />
                <DetailItem label={t('admin.mfgRequestDetail.started')} value={request.startedAt ? new Date(request.startedAt).toLocaleString() : '—'} />
                <DetailItem label={t('admin.mfgRequestDetail.completed')} value={request.completedAt ? new Date(request.completedAt).toLocaleString() : '—'} />
                <DetailItem label={t('admin.mfgRequestDetail.qaStatus')} value={<StatusBadge status={request.order?.manufacturingStatus || '—'} />} />
              </DetailsGrid>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader title={t('admin.mfgRequestDetail.currentStatus')} description={statusLabel(request.status)} />
            <AdminCardBody>
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
                <Button variant="primary" onClick={saveStatus} disabled={saving}>
                  {saving ? t('admin.saving') : t('admin.saveStatus')}
                </Button>
              </div>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader title={t('admin.mfgRequestDetail.orderSnapshot')} />
            <AdminCardBody>
              <DetailsGrid>
                <DetailItem label={t('admin.mfgRequestDetail.orderStatus')} value={<StatusBadge status={request.order?.status || '—'} />} />
                <DetailItem label={t('admin.mfgRequestDetail.customer')} value={request.order?.user?.name || '—'} />
                <DetailItem label={t('admin.mfgRequestDetail.assignedManufacturer')} value={request.order?.manufacturer?.companyName || '—'} />
                <DetailItem label={t('admin.mfgRequestDetail.pricingVersion')} value={request.order?.pricingEquationVersion ? `v${request.order.pricingEquationVersion.version}` : '—'} />
              </DetailsGrid>
            </AdminCardBody>
          </AdminCard>
        </div>
      )}
    </AdminLayout>
  );
};