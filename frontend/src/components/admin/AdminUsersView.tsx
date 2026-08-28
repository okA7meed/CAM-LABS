import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminUsersView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/users', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setUsers(data.data || []);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const accountStatusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE': return t('admin.status.active');
      case 'DISABLED': return t('admin.status.disabled');
      case 'SUSPENDED': return t('admin.status.suspended');
      default: return status;
    }
  };

  return (
    <AdminLayout title={t('admin.users.title')} subtitle={t('admin.users.subtitle')}>
      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>{t('admin.users.name')}</th>
              <th>{t('admin.users.email')}</th>
              <th>{t('admin.users.role')}</th>
              <th>{t('admin.users.status')}</th>
              <th>{t('admin.users.company')}</th>
              <th>{t('admin.users.lastLogin')}</th>
              <th>{t('admin.users.created')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-muted)' }}>{t('admin.users.loading')}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-muted)' }}>{t('admin.users.empty')}</td></tr>
            ) : (
              users.map((u: any) => (
                <tr key={u.id}>
                  <td><strong style={{ color: 'var(--cam-text-primary)' }}>{u.name}</strong></td>
                  <td style={{ color: 'var(--cam-text-muted)', fontSize: '12px' }}>{u.email}</td>
                  <td><span className="badge badge-primary">{u.role}</span></td>
                  <td>
                    <span className={`badge ${u.accountStatus === 'ACTIVE' ? 'badge-primary' : 'badge-warning'}`}>
                      {accountStatusLabel(u.accountStatus)}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{u.company || '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};