import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminCadFilesView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminCadFileDetail } = useStore();
  const [files, setFiles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/cad-files?limit=${limit}&offset=${page * limit}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setFiles(data.data.cadFiles || []);
      setTotal(data.data.total || 0);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'Verified CAD': return t('admin.status.verifiedCad');
      case 'Analyzing': return t('admin.status.analyzing');
      case 'DFM Flagged': return t('admin.status.dfmFlagged');
      case 'Quarantined': return t('admin.status.quarantined');
      case 'Processing failed': return t('admin.status.processingFailed');
      default: return status;
    }
  };

  return (
    <AdminLayout title={t('admin.cadFiles.title')} subtitle={t('admin.cadFiles.subtitle', { total })}>
      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>{t('admin.cadFiles.fileName')}</th>
              <th>{t('admin.cadFiles.customer')}</th>
              <th>{t('admin.cadFiles.format')}</th>
              <th>{t('admin.cadFiles.size')}</th>
              <th>{t('admin.cadFiles.status')}</th>
              <th>{t('admin.cadFiles.volume')}</th>
              <th>{t('admin.cadFiles.dimensions')}</th>
              <th>{t('admin.cadFiles.orders')}</th>
              <th>{t('admin.cadFiles.uploaded')}</th>
              <th>{t('admin.cadFiles.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.cadFiles.loading')}</td></tr>
            ) : files.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.cadFiles.empty')}</td></tr>
            ) : (
              files.map((f: any) => (
                <tr key={f.id}>
                  <td><strong style={{ color: 'var(--cam-text-primary)', fontSize: '13px' }}>{f.name}</strong></td>
                  <td style={{ fontSize: '12px' }}>{f.user?.name || '—'}</td>
                  <td><span className="badge badge-neutral">{f.format}</span></td>
                  <td style={{ fontSize: '12px' }}>{f.size}</td>
                  <td>
                    <span className={`badge ${f.status === 'Verified CAD' ? 'badge-primary' : f.status === 'Analyzing' ? 'badge-warning' : 'badge-error'}`}>
                      {statusLabel(f.status)}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{f.volume || '—'}</td>
                  <td style={{ fontSize: '12px' }}>{f.dimensions || '—'}</td>
                  <td>{f._count?.orders || 0}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => openAdminCadFileDetail(f.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                      {t('admin.lists.view')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          <button className="btn btn-sm btn-outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            {t('admin.lists.previous')}
          </button>
          <span style={{ color: 'var(--cam-text-muted)', padding: '6px 12px', fontSize: '13px' }}>
            {t('admin.lists.page', { current: page + 1 })}
          </span>
          <button className="btn btn-sm btn-outline" disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)}>
            {t('admin.lists.next')}
          </button>
        </div>
      )}
    </AdminLayout>
  );
};