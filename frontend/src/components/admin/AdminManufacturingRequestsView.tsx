import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { AdminLayout } from './AdminLayout';

export const AdminManufacturingRequestsView: React.FC = () => {
  const { showToast, openAdminManufacturingRequestDetail } = useStore();
  const { t } = useTranslation();
  const [requests, setRequests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/v1/admin/manufacturing-requests?${params}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setRequests(data.data.requests || []);
      setTotal(data.data.total || 0);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/admin/manufacturing-requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast('Updated', `Request status changed to ${status}`, 'success');
      load();
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    }
  };

  return (
    <AdminLayout title="Manufacturing Requests" subtitle={t('admin.totalRequests', { total })}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          style={{ width: '200px', padding: '8px 12px', background: 'var(--cam-surface-2)', border: '1px solid var(--cam-border-subtle)', borderRadius: '6px', color: 'var(--cam-text-primary)' }}>
          <option value="">{t('admin.filters.allStatuses')}</option>
          <option value="PENDING">{t('admin.status.pending')}</option>
          <option value="ACCEPTED">{t('admin.status.accepted')}</option>
          <option value="IN_PROGRESS">{t('admin.status.inProgress')}</option>
          <option value="COMPLETED">{t('admin.status.completed')}</option>
          <option value="CANCELLED">{t('admin.status.cancelled')}</option>
        </select>
        <button className="btn btn-sm btn-outline" onClick={load}><Icon name="reset" size={14} /> {t('admin.refresh')}</button>
      </div>

      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Order</th>
              <th>Manufacturer</th>
              <th>Technology</th>
              <th>Material</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-muted)' }}>Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-muted)' }}>No requests found</td></tr>
            ) : (
              requests.map((r: any) => (
                <tr key={r.id}>
                  <td><strong className="mono-primary">{r.id.slice(0, 8)}</strong></td>
                  <td>{r.order?.id || '—'}</td>
                  <td>{r.manufacturer?.companyName || '—'}</td>
                  <td><span className="badge badge-neutral">{r.technology}</span></td>
                  <td style={{ fontSize: '12px' }}>{r.material}</td>
                  <td>{r.quantity}</td>
                  <td>
                    <span className={`badge ${r.status === 'COMPLETED' ? 'badge-primary' : r.status === 'IN_PROGRESS' ? 'badge-warning' : r.status === 'PENDING' ? 'badge-neutral' : r.status === 'CANCELLED' ? 'badge-error' : 'badge-primary'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {r.status === 'PENDING' && (
                        <>
                          <button className="btn btn-sm btn-outline" onClick={() => updateStatus(r.id, 'ACCEPTED')} style={{ padding: '2px 6px', fontSize: '10px' }}>Accept</button>
                          <button className="btn btn-sm btn-outline" onClick={() => updateStatus(r.id, 'CANCELLED')} style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--cam-danger)' }}>Cancel</button>
                        </>
                      )}
                      {r.status === 'ACCEPTED' && (
                        <button className="btn btn-sm btn-outline" onClick={() => updateStatus(r.id, 'IN_PROGRESS')} style={{ padding: '2px 6px', fontSize: '10px' }}>Start</button>
                      )}
                      {r.status === 'IN_PROGRESS' && (
                        <button className="btn btn-sm btn-outline" onClick={() => updateStatus(r.id, 'COMPLETED')} style={{ padding: '2px 6px', fontSize: '10px' }}>Complete</button>
                      )}
                      <button className="btn btn-sm btn-outline" onClick={() => openAdminManufacturingRequestDetail(r.id)} style={{ padding: '2px 6px', fontSize: '10px' }}>View</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};