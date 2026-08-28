import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

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
        <div style={{ display: 'grid', gap: '20px' }}>
          <button className="btn btn-sm btn-outline" onClick={() => { closeAdminDetail(); setActiveView('admin-manufacturers'); }}>
            {t('admin.manufacturerDetail.backToManufacturers')}
          </button>

          <Section title={t('admin.manufacturerDetail.basicInformation')}>
            <Grid>
              <DetailItem label={t('admin.manufacturerDetail.manufacturerId')} value={manufacturer.id} />
              <DetailItem label={t('admin.manufacturerDetail.companyName')} value={manufacturer.companyName} />
              <DetailItem label={t('admin.manufacturerDetail.contactPerson')} value={manufacturer.contactPerson} />
              <DetailItem label={t('admin.manufacturerDetail.email')} value={manufacturer.email} />
              <DetailItem label={t('admin.manufacturerDetail.phone')} value={manufacturer.phone || '—'} />
              <DetailItem label={t('admin.manufacturerDetail.location')} value={manufacturer.location || '—'} />
              <DetailItem label={t('admin.manufacturerDetail.status')} value={manufacturer.status} />
            </Grid>
          </Section>

          <Section title={t('admin.manufacturerDetail.capabilities')}>
            <Grid>
              <DetailItem label={t('admin.manufacturerDetail.supportedTechnologies')} value={(manufacturer.supportedTechnologies || []).join(', ') || '—'} />
              <DetailItem label={t('admin.manufacturerDetail.supportedMaterials')} value={(manufacturer.supportedMaterials || []).join(', ') || '—'} />
              <DetailItem label={t('admin.manufacturerDetail.capacity')} value={manufacturer.capacity ?? '—'} />
              <DetailItem label={t('admin.manufacturerDetail.availability')} value={manufacturer.availability} />
            </Grid>
          </Section>

          <Section title={t('admin.manufacturerDetail.operations')}>
            <Grid>
              <DetailItem label={t('admin.manufacturerDetail.currentOrders')} value={manufacturer.currentOrders ?? 0} />
              <DetailItem label={t('admin.manufacturerDetail.completedOrders')} value={manufacturer.completedOrders ?? 0} />
              <DetailItem label={t('admin.manufacturerDetail.performance')} value={manufacturer.performanceRating ? `${manufacturer.performanceRating}/5` : '—'} />
              <DetailItem label={t('admin.manufacturerDetail.notes')} value={manufacturer.notes || '—'} />
            </Grid>
          </Section>

          <Section title={t('admin.manufacturerDetail.recentOrders')}>
            <List items={manufacturer.orders || []} renderItem={(order) => <div><strong>{order.id}</strong> · {order.technology} · {order.status}</div>} />
          </Section>

          <Section title={t('admin.manufacturerDetail.manufacturingRequests')}>
            <List items={manufacturer.manufacturingRequests || []} renderItem={(request) => <div><strong>{request.id}</strong> · {request.status} · {request.order?.id || '—'}</div>} />
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
    <div style={{ fontSize: '11px', color: 'var(--cam-text-faint)', marginBottom: '6px' }}>{label}</div>
    <div style={{ color: 'var(--cam-text-secondary)' }}>{value || '—'}</div>
  </div>
);

const List: React.FC<{ items: any[]; renderItem: (item: any) => React.ReactNode }> = ({ items, renderItem }) => (
  <div style={{ display: 'grid', gap: '10px' }}>
    {items.map((item) => <div key={item.id} style={{ padding: '12px', background: 'var(--cam-surface-2)', borderRadius: '8px' }}>{renderItem(item)}</div>)}
    {items.length === 0 && <div style={{ color: 'var(--cam-text-muted)' }}>No records found.</div>}
  </div>
);
