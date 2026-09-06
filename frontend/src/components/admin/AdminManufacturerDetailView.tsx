import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardBody, AdminCardHeader } from './ui/Card';
import { DetailsGrid, DetailItem } from './ui/DetailItem';
import { StatusBadge, StatusTone } from './ui/StatusBadge';
import { TechBadge } from './ui/TechBadge';
import { Button } from './ui/Button';

const STATUS_TONES: Record<string, StatusTone> = {
  ACTIVE: 'delivered',
  INACTIVE: 'unknown',
  DISABLED: 'unknown',
  SUSPENDED: 'cancelled',
};

const AVAILABILITY_TONES: Record<string, StatusTone> = {
  AVAILABLE: 'delivered',
  BUSY: 'review',
  OFFLINE: 'unknown',
};

const REQUEST_TONES: Record<string, StatusTone> = {
  PENDING: 'review',
  ACCEPTED: 'delivered',
  REJECTED: 'cancelled',
  IN_PROGRESS: 'production',
  COMPLETED: 'delivered',
  CANCELLED: 'cancelled',
};

export const AdminManufacturerDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAdminManufacturerId, closeAdminDetail, setActiveView, showToast } = useStore();
  const [manufacturer, setManufacturer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!selectedAdminManufacturerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/manufacturers/${selectedAdminManufacturerId}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load manufacturer');
      const data = await res.json();
      setManufacturer(data.data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load manufacturer details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedAdminManufacturerId]);

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE': return t('admin.status.active');
      case 'INACTIVE': return t('admin.status.inactive');
      case 'DISABLED': return t('admin.status.disabled');
      case 'SUSPENDED': return t('admin.status.suspended');
      default: return status;
    }
  };

  const availabilityLabel = (availability: string): string => {
    switch (availability) {
      case 'AVAILABLE': return t('admin.status.available');
      case 'BUSY': return t('admin.status.busy');
      case 'OFFLINE': return t('admin.status.offline');
      default: return availability;
    }
  };

  if (!selectedAdminManufacturerId) {
    return <AdminLayout title={t('admin.manufacturerDetail.title')}><div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.manufacturerDetail.noSelected')}</div></AdminLayout>;
  }

  return (
    <AdminLayout title={`${t('admin.manufacturerDetail.title')} · ${selectedAdminManufacturerId}`} subtitle={t('admin.manufacturerDetail.subtitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--cam-text-faint)' }}>{t('admin.manufacturerDetail.loading')}</div>
      ) : !manufacturer ? (
        <div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.manufacturerDetail.notFound')}</div>
      ) : (
        <div className="admin-section">
          <AdminCard>
            <AdminCardHeader
              title={manufacturer.companyName || manufacturer.id}
              description={manufacturer.id}
              actions={
                <Button variant="outline" size="sm" icon="arrowLeft" onClick={() => { closeAdminDetail(); setActiveView('admin-manufacturers'); }}>
                  {t('admin.manufacturerDetail.backToManufacturers')}
                </Button>
              }
            />
            <AdminCardBody>
              <DetailsGrid>
                <DetailItem label={t('admin.manufacturerDetail.manufacturerId')} value={manufacturer.id} />
                <DetailItem label={t('admin.manufacturerDetail.companyName')} value={manufacturer.companyName} />
                <DetailItem label={t('admin.manufacturerDetail.contactPerson')} value={manufacturer.contactPerson} />
                <DetailItem label={t('admin.manufacturerDetail.email')} value={manufacturer.email} />
                <DetailItem label={t('admin.manufacturerDetail.phone')} value={manufacturer.phone || '—'} />
                <DetailItem label={t('admin.manufacturerDetail.location')} value={manufacturer.location || '—'} />
                <DetailItem label={t('admin.manufacturerDetail.status')} value={<StatusBadge status={statusLabel(manufacturer.status)} tone={STATUS_TONES[manufacturer.status] ?? 'unknown'} />} />
              </DetailsGrid>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader title={t('admin.manufacturerDetail.capabilities')} />
            <AdminCardBody>
              <DetailsGrid>
                <DetailItem
                  label={t('admin.manufacturerDetail.supportedTechnologies')}
                  value={(manufacturer.supportedTechnologies || []).length ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {(manufacturer.supportedTechnologies || []).map((tech: string) => <TechBadge key={tech} label={tech} />)}
                    </div>
                  ) : '—'}
                />
                <DetailItem label={t('admin.manufacturerDetail.supportedMaterials')} value={(manufacturer.supportedMaterials || []).join(', ') || '—'} />
                <DetailItem label={t('admin.manufacturerDetail.capacity')} value={manufacturer.capacity ?? '—'} />
                <DetailItem label={t('admin.manufacturerDetail.availability')} value={<StatusBadge status={availabilityLabel(manufacturer.availability)} tone={AVAILABILITY_TONES[manufacturer.availability] ?? 'unknown'} />} />
              </DetailsGrid>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader title={t('admin.manufacturerDetail.operations')} />
            <AdminCardBody>
              <DetailsGrid>
                <DetailItem label={t('admin.manufacturerDetail.currentOrders')} value={manufacturer.currentOrders ?? 0} />
                <DetailItem label={t('admin.manufacturerDetail.completedOrders')} value={manufacturer.completedOrders ?? 0} />
                <DetailItem label={t('admin.manufacturerDetail.performance')} value={manufacturer.performanceRating ? `${manufacturer.performanceRating}/5` : '—'} />
                <DetailItem label={t('admin.manufacturerDetail.notes')} value={manufacturer.notes || '—'} />
              </DetailsGrid>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader title={t('admin.manufacturerDetail.recentOrders')} />
            <AdminCardBody flush>
              {(manufacturer.orders || []).length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{t('admin.manufacturingRequests.order')}</th>
                        <th>{t('admin.manufacturingRequests.technology')}</th>
                        <th>{t('admin.manufacturerDetail.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(manufacturer.orders || []).map((order: any) => (
                        <tr key={order.id}>
                          <td className="mono-primary">{order.id}</td>
                          <td>{order.technology ? <TechBadge label={order.technology} /> : '—'}</td>
                          <td><StatusBadge status={order.status || '—'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '18px', color: 'var(--cam-text-muted)', fontSize: '13px' }}>{t('admin.lists.empty')}</div>
              )}
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader title={t('admin.manufacturerDetail.manufacturingRequests')} />
            <AdminCardBody flush>
              {(manufacturer.manufacturingRequests || []).length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{t('admin.mfgRequestDetail.requestId')}</th>
                        <th>{t('admin.mfgRequestDetail.orderId')}</th>
                        <th>{t('admin.mfgRequestDetail.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(manufacturer.manufacturingRequests || []).map((request: any) => (
                        <tr key={request.id}>
                          <td className="mono-primary">{request.id}</td>
                          <td>{request.order?.id || '—'}</td>
                          <td><StatusBadge status={statusLabel(request.status)} tone={REQUEST_TONES[request.status] ?? 'unknown'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '18px', color: 'var(--cam-text-muted)', fontSize: '13px' }}>{t('admin.lists.empty')}</div>
              )}
            </AdminCardBody>
          </AdminCard>
        </div>
      )}
    </AdminLayout>
  );
};