import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminQuotesView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminQuoteDetail } = useStore();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/quotes?limit=${limit}&offset=${page * limit}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setQuotes(data.data.quotes || []);
      setTotal(data.data.total || 0);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'Ready for Approval': return t('admin.status.readyForApproval');
      case 'Approved': return t('admin.status.approved');
      case 'Draft': return t('admin.status.draft');
      case 'Expired': return t('admin.status.expired');
      default: return status;
    }
  };

  return (
    <AdminLayout title={t('admin.quotes.title')} subtitle={t('admin.quotes.subtitle', { total })}>
      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>{t('admin.quotes.quoteId')}</th>
              <th>{t('admin.quotes.customer')}</th>
              <th>{t('admin.quotes.partName')}</th>
              <th>{t('admin.quotes.technology')}</th>
              <th>{t('admin.quotes.material')}</th>
              <th>{t('admin.quotes.qty')}</th>
              <th>{t('admin.quotes.unitPrice')}</th>
              <th>{t('admin.quotes.total')}</th>
              <th>{t('admin.quotes.status')}</th>
              <th>{t('admin.quotes.date')}</th>
              <th>{t('admin.quotes.validUntil')}</th>
              <th>{t('admin.quotes.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.quotes.loading')}</td></tr>
            ) : quotes.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.quotes.empty')}</td></tr>
            ) : (
              quotes.map((q: any) => (
                <tr key={q.id}>
                  <td><strong className="mono-primary">{q.id}</strong></td>
                  <td>{q.user?.name || '—'}</td>
                  <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.partName}</td>
                  <td><span className="badge badge-neutral">{q.technology}</span></td>
                  <td style={{ fontSize: '12px' }}>{q.material}</td>
                  <td>{q.quantity}</td>
                  <td>{q.unitPrice}</td>
                  <td><strong>{q.totalPrice}</strong></td>
                  <td>
                    <span className={`badge ${q.status === 'Ready for Approval' ? 'badge-warning' : q.status === 'Approved' ? 'badge-primary' : 'badge-neutral'}`}>
                      {statusLabel(q.status)}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{new Date(q.createdAt).toLocaleDateString()}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{q.validUntil || '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => openAdminQuoteDetail(q.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>
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