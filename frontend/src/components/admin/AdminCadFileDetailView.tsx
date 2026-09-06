import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardHeader, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { DetailsGrid, DetailItem } from './ui/DetailItem';
import { EmptyState } from './ui/States';
import { StatusBadge, StatusTone, statusToneOf } from './ui/StatusBadge';

const FILE_TONES: Record<string, StatusTone> = {
  'Verified CAD': 'delivered',
  'Analyzing': 'review',
  'DFM Flagged': 'inspection',
  'Quarantined': 'cancelled',
  'Processing Failed': 'cancelled',
};

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
    return (
      <AdminLayout title={t('admin.cadFileDetail.title')}>
        <div className="admin-section">
          <EmptyState icon="file" text={t('admin.cadFileDetail.noSelected')} />
        </div>
      </AdminLayout>
    );
  }

  const latestVersion = cadFile?.versions?.[0];

  return (
    <AdminLayout title={`${t('admin.cadFileDetail.title')} · ${selectedAdminCadFileId}`} subtitle={t('admin.cadFileDetail.subtitle')}>
      <div className="admin-section">
        {loading ? (
          <div className="admin-muted" style={{ textAlign: 'center', padding: '60px 0' }}>{t('admin.cadFileDetail.loading')}</div>
        ) : !cadFile ? (
          <EmptyState icon="file" text={t('admin.cadFileDetail.notFound')} />
        ) : (
          <>
            <AdminCard>
              <AdminCardHeader
                title={cadFile.name}
                description={cadFile.user?.name}
                actions={
                  <Button variant="outline" size="sm" icon="arrowLeft" onClick={() => { closeAdminDetail(); setActiveView('admin-cad-files'); }}>
                    {t('admin.cadFileDetail.backToCadFiles')}
                  </Button>
                }
              />
              <AdminCardBody>
                <DetailsGrid>
                  <DetailItem label={t('admin.cadFileDetail.fileName')} value={cadFile.name} />
                  <DetailItem label={t('admin.cadFileDetail.fileType')} value={cadFile.format} />
                  <DetailItem label={t('admin.cadFileDetail.fileSize')} value={cadFile.size} />
                  <DetailItem label={t('admin.cadFileDetail.customer')} value={cadFile.user?.name || '—'} />
                  <DetailItem label={t('admin.cadFileDetail.uploadDate')} value={new Date(cadFile.createdAt).toLocaleString()} />
                  <DetailItem
                    label={t('admin.cadFileDetail.status')}
                    value={<StatusBadge status={cadFile.status} tone={FILE_TONES[cadFile.status] ?? 'unknown'} />}
                  />
                </DetailsGrid>
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.cadFileDetail.geometryAndProcessing')} />
              <AdminCardBody>
                <DetailsGrid>
                  <DetailItem label={t('admin.cadFileDetail.dimensions')} value={cadFile.dimensions || '—'} />
                  <DetailItem label={t('admin.cadFileDetail.volume')} value={cadFile.volume || '—'} />
                  <DetailItem label={t('admin.cadFileDetail.meshTriangles')} value={cadFile.meshTriangles || '—'} />
                  <DetailItem
                    label={t('admin.cadFileDetail.latestScan')}
                    value={latestVersion?.scanStatus
                      ? <StatusBadge status={latestVersion.scanStatus} tone={FILE_TONES[latestVersion.scanStatus] ?? 'unknown'} />
                      : '—'}
                  />
                  <DetailItem
                    label={t('admin.cadFileDetail.processingStatus')}
                    value={latestVersion?.processingStatus
                      ? <StatusBadge status={latestVersion.processingStatus} tone={FILE_TONES[latestVersion.processingStatus] ?? 'unknown'} />
                      : '—'}
                  />
                  <DetailItem
                    label={t('admin.cadFileDetail.validationStatus')}
                    value={latestVersion?.uploadStatus
                      ? <StatusBadge status={latestVersion.uploadStatus} tone={FILE_TONES[latestVersion.uploadStatus] ?? 'unknown'} />
                      : '—'}
                  />
                </DetailsGrid>
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.cadFileDetail.associatedOrders')} />
              <AdminCardBody flush>
                {cadFile.orders?.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>{t('admin.orders.col.id')}</th>
                          <th>{t('admin.orders.col.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cadFile.orders.map((entry: any) => (
                          <tr key={entry.order?.id || entry.cadFileId}>
                            <td className="mono-primary">{entry.order?.id || '—'}</td>
                            <td>
                              <StatusBadge status={entry.order?.status || '—'} tone={statusToneOf(entry.order?.status ?? '')} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon="cube" text={t('admin.lists.empty')} />
                )}
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.cadFileDetail.versions')} />
              <AdminCardBody flush>
                {cadFile.versions?.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>{t('geometry.version')}</th>
                          <th>{t('admin.cadFileDetail.fileName')}</th>
                          <th>{t('admin.cadFileDetail.processingStatus')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cadFile.versions.map((version: any) => (
                          <tr key={version.id}>
                            <td className="mono-primary">v{version.version}</td>
                            <td>{version.originalName}</td>
                            <td>
                              <StatusBadge status={version.processingStatus} tone={FILE_TONES[version.processingStatus] ?? 'unknown'} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon="file" text={t('admin.lists.empty')} />
                )}
              </AdminCardBody>
            </AdminCard>
          </>
        )}
      </div>
    </AdminLayout>
  );
};