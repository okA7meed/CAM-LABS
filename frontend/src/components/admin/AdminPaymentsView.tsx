import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminPaymentsView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/payments?limit=${limit}&offset=${page * limit}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setPayments(data.data.payments || []);
      setTotal(data.data.total || 0);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'PAID': return t('admin.status.paid');
      case 'PENDING': return t('admin.status.pending');
      case 'FAILED': return t('admin.status.failed');
      case 'REFUNDED': return t('admin.status.refunded');
      case 'PARTIALLY_REFUNDED': return t('admin.status.partiallyRefunded');
      default: return status;
    }
  };

  return (
    <AdminLayout title={t('admin.payments.title')} subtitle={t('admin.payments.subtitle', { total })}>
      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>{t('admin.payments.paymentId')}</th>
              <th>{t('admin.payments.order')}</th>
              <th>{t('admin.payments.customer')}</th>
              <th>{t('admin.payments.amount')}</th>
              <th>{t('admin.payments.currency')}</th>
              <th>{t('admin.payments.method')}</th>
              <th>{t('admin.payments.status')}</th>
              <th>{t('admin.payments.transactionId')}</th>
              <th>{t('admin.payments.date')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.payments.loading')}</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.payments.empty')}</td></tr>
            ) : (
              payments.map((p: any) => (
                <tr key={p.id}>
                  <td><strong className="mono-primary">{p.id.slice(0, 8)}</strong></td>
                  <td>{p.order?.id || '—'}</td>
                  <td>{p.user?.name || '—'}</td>
                  <td><strong>{p.amount?.toFixed(2)}</strong></td>
                  <td>{p.currency}</td>
                  <td style={{ fontSize: '12px' }}>{p.paymentMethod || '—'}</td>
                  <td>
                    <span className={`badge ${p.paymentStatus === 'PAID' ? 'badge-primary' : p.paymentStatus === 'PENDING' ? 'badge-warning' : p.paymentStatus === 'FAILED' ? 'badge-error' : 'badge-neutral'}`}>
                      {statusLabel(p.paymentStatus)}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{p.transactionId || '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
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