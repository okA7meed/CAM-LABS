import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminCadFileDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAdminCadFileId, closeAdminDetail, setActiveView, showToast } = useStore();
  const [cadFile, setCadFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!selectedAdminCadFileId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/cad-files/${selectedAdminCadFileId}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load CAD file');
      const data = await res.json();
      setCadFile(data.data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load CAD file details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedAdminCadFileId]);

  if (!selectedAdminCadFileId) {
    return <AdminLayout title={t('admin.cadFileDetail.title')}><div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.cadFileDetail.noSelected')}</div></AdminLayout>;
  }

  return (
    <AdminLayout title={`${t('admin.cadFileDetail.title')} · ${selectedAdminCadFileId}`} subtitle={t('admin.cadFileDetail.subtitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--cam-text-faint)' }}>{t('admin.cadFileDetail.loading')}</div>
      ) : !cadFile ? (
        <div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.cadFileDetail.notFound')}</div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          <button className="btn btn-sm btn-outline" onClick={() => { closeAdminDetail(); setActiveView('admin-cad-files'); }}>
            {t('admin.cadFileDetail.backToCadFiles')}
          </button>

          <Section title={t('admin.cadFileDetail.fileInformation')}>
            <Grid>
              <DetailItem label={t('admin.cadFileDetail.fileName')} value={cadFile.name} />
              <DetailItem label={t('admin.cadFileDetail.fileType')} value={cadFile.format} />
              <DetailItem label={t('admin.cadFileDetail.fileSize')} value={cadFile.size} />
              <DetailItem label={t('admin.cadFileDetail.customer')} value={cadFile.user?.name || '—'} />
              <DetailItem label={t('admin.cadFileDetail.uploadDate')} value={new Date(cadFile.createdAt).toLocaleString()} />
              <DetailItem label={t('admin.cadFileDetail.status')} value={cadFile.status} />
            </Grid>
          </Section>

          <Section title={t('admin.cadFileDetail.geometryAndProcessing')}>
            <Grid>
              <DetailItem label={t('admin.cadFileDetail.dimensions')} value={cadFile.dimensions || '—'} />
              <DetailItem label={t('admin.cadFileDetail.volume')} value={cadFile.volume || '—'} />
              <DetailItem label={t('admin.cadFileDetail.meshTriangles')} value={cadFile.meshTriangles || '—'} />
              <DetailItem label={t('admin.cadFileDetail.latestScan')} value={cadFile.versions?.[0]?.scanStatus || '—'} />
              <DetailItem label={t('admin.cadFileDetail.processingStatus')} value={cadFile.versions?.[0]?.processingStatus || '—'} />
              <DetailItem label={t('admin.cadFileDetail.validationStatus')} value={cadFile.versions?.[0]?.uploadStatus || '—'} />
            </Grid>
          </Section>

          <Section title={t('admin.cadFileDetail.associatedOrders')}>
            <List items={cadFile.orders || []} renderItem={(entry) => <div><strong>{entry.order?.id}</strong> · {entry.order?.status || '—'}</div>} />
          </Section>

          <Section title={t('admin.cadFileDetail.versions')}>
            <List items={cadFile.versions || []} renderItem={(version) => <div><strong>v{version.version}</strong> · {version.originalName} · {version.processingStatus}</div>} />
          </Section>
        </div>
      )}
    </AdminLayout>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="dashboard-section-panel" style={{ padding: '20px' }}>
    <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-primary)' }}>{title}</h3>
    {children}
  </div>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>{children}</div>
);

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: '11px', color: 'var(--cam-text-faint)', marginBottom: '6px' }}>{label}</div>
    <div style={{ color: 'var(--cam-text-primary)' }}>{value || '—'}</div>
  </div>
);

const List: React.FC<{ items: any[]; renderItem: (item: any) => React.ReactNode }> = ({ items, renderItem }) => (
  <div style={{ display: 'grid', gap: '10px' }}>
    {items.map((item) => <div key={item.id || item.cadFileId} style={{ padding: '12px', background: 'var(--cam-surface-1)', borderRadius: '8px' }}>{renderItem(item)}</div>)}
    {items.length === 0 && <div style={{ color: 'var(--cam-text-muted)' }}>No records found.</div>}
  </div>
);
