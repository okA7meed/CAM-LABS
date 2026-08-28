import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { AdminLayout } from './AdminLayout';

export const AdminCustomersView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminCustomerDetail } = useStore();
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/customers?limit=${limit}&offset=${page * limit}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load customers');
      const data = await res.json();
      setCustomers(data.data.customers || []);
      setTotal(data.data.total || 0);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCustomers(); }, [page]);

  const totalPages = Math.ceil(total / limit);

  const accountStatusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE': return t('admin.status.active');
      case 'DISABLED': return t('admin.status.disabled');
      case 'SUSPENDED': return t('admin.status.suspended');
      default: return status;
    }
  };

  return (
    <AdminLayout title={t('admin.customers.title')} subtitle={t('admin.customers.subtitle', { total })}>
      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>{t('admin.customers.name')}</th>
              <th>{t('admin.customers.email')}</th>
              <th>{t('admin.customers.company')}</th>
              <th>{t('admin.customers.role')}</th>
              <th>{t('admin.customers.status')}</th>
              <th>{t('admin.customers.orders')}</th>
              <th>{t('admin.customers.quotes')}</th>
              <th>{t('admin.customers.cadFiles')}</th>
              <th>{t('admin.customers.joined')}</th>
              <th>{t('admin.customers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.customers.loading')}</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.customers.empty')}</td></tr>
            ) : (
              customers.map((c: any) => (
                <tr key={c.id}>
                  <td><strong style={{ color: 'var(--cam-text-primary)' }}>{c.name}</strong></td>
                  <td style={{ color: 'var(--cam-text-muted)', fontSize: '12px' }}>{c.email}</td>
                  <td style={{ fontSize: '12px' }}>{c.company || '—'}</td>
                  <td><span className="badge badge-neutral">{c.role}</span></td>
                  <td>
                    <span className={`badge ${c.accountStatus === 'ACTIVE' ? 'badge-primary' : 'badge-warning'}`}>
                      {accountStatusLabel(c.accountStatus)}
                    </span>
                  </td>
                  <td>{c._count?.orders || 0}</td>
                  <td>{c._count?.quotes || 0}</td>
                  <td>{c._count?.cadFiles || 0}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openAdminCustomerDetail(c.id)}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      <Icon name="eye" size={12} /> {t('admin.lists.view')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          <button className="btn btn-sm btn-outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>{t('admin.lists.previous')}</button>
          <span style={{ color: 'var(--cam-text-muted)', padding: '6px 12px', fontSize: '13px' }}>{t('admin.lists.pageOf', { current: page + 1, total: totalPages })}</span>
          <button className="btn btn-sm btn-outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>{t('admin.lists.next')}</button>
        </div>
      )}
    </AdminLayout>
  );
};