import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminAuditLogsView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 30;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/audit-logs?limit=${limit}&offset=${page * limit}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setLogs(data.data.logs || []);
      setTotal(data.data.total || 0);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  return (
    <AdminLayout title={t('admin.auditLogs.title')} subtitle={t('admin.auditLogs.subtitle', { total })}>
      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>{t('admin.auditLogs.admin')}</th>
              <th>{t('admin.auditLogs.action')}</th>
              <th>{t('admin.auditLogs.entity')}</th>
              <th>{t('admin.auditLogs.entityId')}</th>
              <th>{t('admin.auditLogs.details')}</th>
              <th>{t('admin.auditLogs.date')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-muted)' }}>{t('admin.auditLogs.loading')}</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-muted)' }}>{t('admin.auditLogs.empty')}</td></tr>
            ) : (
              logs.map((l: any) => (
                <tr key={l.id}>
                  <td style={{ fontSize: '12px' }}>{l.user?.name || l.user?.email || '—'}</td>
                  <td><span className="badge badge-neutral">{l.action}</span></td>
                  <td style={{ fontSize: '12px' }}>{l.entityType}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{l.entityId ? l.entityId.slice(0, 12) : '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.newValue ? JSON.stringify(l.newValue).slice(0, 60) : '—'}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{new Date(l.createdAt).toLocaleString()}</td>
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