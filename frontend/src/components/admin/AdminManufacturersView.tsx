import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminManufacturersView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminManufacturerDetail } = useStore();
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/manufacturers?limit=${limit}&offset=${page * limit}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setManufacturers(data.data.manufacturers || []);
      setTotal(data.data.total || 0);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

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

  return (
    <AdminLayout title={t('admin.manufacturers.title')} subtitle={t('admin.manufacturers.subtitle', { total })}>
      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>{t('admin.manufacturers.company')}</th>
              <th>{t('admin.manufacturers.contact')}</th>
              <th>{t('admin.manufacturers.email')}</th>
              <th>{t('admin.manufacturers.location')}</th>
              <th>{t('admin.manufacturers.technologies')}</th>
              <th>{t('admin.manufacturers.capacity')}</th>
              <th>{t('admin.manufacturers.orders')}</th>
              <th>{t('admin.manufacturers.rating')}</th>
              <th>{t('admin.manufacturers.status')}</th>
              <th>{t('admin.manufacturers.availability')}</th>
              <th>{t('admin.manufacturers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.manufacturers.loading')}</td></tr>
            ) : manufacturers.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.manufacturers.empty')}</td></tr>
            ) : (
              manufacturers.map((m: any) => (
                <tr key={m.id}>
                  <td><strong style={{ color: 'var(--cam-text-secondary)' }}>{m.companyName}</strong></td>
                  <td style={{ fontSize: '12px' }}>{m.contactPerson}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{m.email}</td>
                  <td style={{ fontSize: '12px' }}>{m.location || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {(m.supportedTechnologies || []).map((t: string) => (
                        <span key={t} className="badge badge-neutral" style={{ fontSize: '10px' }}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td>{m.capacity || '—'}</td>
                  <td>{m.currentOrders || 0}/{m.completedOrders || 0}</td>
                  <td>{m.performanceRating ? `${m.performanceRating}/5` : '—'}</td>
                  <td>
                    <span className={`badge ${m.status === 'ACTIVE' ? 'badge-primary' : m.status === 'INACTIVE' ? 'badge-warning' : 'badge-error'}`}>
                      {statusLabel(m.status)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${m.availability === 'AVAILABLE' ? 'badge-primary' : 'badge-warning'}`}>
                      {availabilityLabel(m.availability)}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => openAdminManufacturerDetail(m.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                      <strong>{t('admin.lists.view')}</strong>
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