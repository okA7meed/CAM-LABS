import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { AdminLayout } from './AdminLayout';

interface OrderData {
  id: string;
  partName: string;
  technology: string;
  material: string;
  quantity: number;
  status: string;
  totalCost: string;
  paymentStatus: string;
  manufacturingStatus: string;
  shippingStatus: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; company?: string };
  manufacturer?: { id: string; companyName: string };
}

export const AdminOrdersView: React.FC = () => {
  const { showToast, openAdminOrderDetail } = useStore();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [techFilter, setTechFilter] = useState('');
  const [search, setSearch] = useState('');
  const limit = 20;

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (techFilter) params.set('technology', techFilter);

      const res = await fetch(`/api/v1/admin/orders?${params}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(data.data.orders || []);
      setTotal(data.data.total || 0);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [page, statusFilter, techFilter]);

  const totalPages = Math.ceil(total / limit);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'In Review': '#f59e0b',
      'In Production': '#3b82f6',
      'Quality Inspection': '#8b5cf6',
      'Delivered': '#10b981',
      'Cancelled': '#ef4444',
    };
    return colors[status] || '#64748b';
  };

  return (
    <AdminLayout title="Orders Management" subtitle={t('admin.totalOrders', { total })}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-control"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '240px', padding: '8px 12px', background: 'var(--cam-surface-2)', border: '1px solid var(--cam-border-subtle)', borderRadius: '6px', color: 'var(--cam-text-primary)' }}
        />
        <select
          className="form-control"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          style={{ width: '160px', padding: '8px 12px', background: 'var(--cam-surface-2)', border: '1px solid var(--cam-border-subtle)', borderRadius: '6px', color: 'var(--cam-text-primary)' }}
        >
          <option value="">{t('admin.filters.allStatuses')}</option>
          <option value="In Review">{t('admin.status.inReview')}</option>
          <option value="In Production">{t('admin.status.inProduction')}</option>
          <option value="Quality Inspection">{t('admin.status.qualityInspection')}</option>
          <option value="Delivered">{t('admin.status.delivered')}</option>
          <option value="Cancelled">{t('admin.status.cancelled')}</option>
        </select>
        <select
          className="form-control"
          value={techFilter}
          onChange={(e) => { setTechFilter(e.target.value); setPage(0); }}
          style={{ width: '160px', padding: '8px 12px', background: 'var(--cam-surface-2)', border: '1px solid var(--cam-border-subtle)', borderRadius: '6px', color: 'var(--cam-text-primary)' }}
        >
          <option value="">{t('admin.filters.allTechnologies')}</option>
          <option value="FDM">FDM</option>
          <option value="SLA">SLA</option>
          <option value="SLS">SLS</option>
          <option value="CNC_MILLING">CNC Milling</option>
          <option value="CNC_TURNING">CNC Turning</option>
          <option value="LASER_CUTTING">Laser Cutting</option>
        </select>
        <button className="btn btn-sm btn-outline" onClick={loadOrders} style={{ padding: '8px 16px' }}>
          <Icon name="reset" size={14} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Part Name</th>
              <th>Technology</th>
              <th>Material</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Status</th>
              <th>Manufacturer</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-muted)' }}>Loading orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-muted)' }}>No orders found</td></tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td><strong className="mono-primary">{order.id}</strong></td>
                  <td>{order.user?.name || '—'}</td>
                  <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.partName}</td>
                  <td><span className="badge badge-neutral">{order.technology}</span></td>
                  <td style={{ fontSize: '12px' }}>{order.material}</td>
                  <td>{order.quantity}</td>
                  <td><strong>{order.totalCost}</strong></td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: `${getStatusColor(order.status)}20`,
                      color: getStatusColor(order.status),
                      border: `1px solid ${getStatusColor(order.status)}40`,
                    }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{order.manufacturer?.companyName || '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openAdminOrderDetail(order.id)}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      <Icon name="eye" size={12} /> View
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
          <button className="btn btn-sm btn-outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </button>
          <span style={{ color: 'var(--cam-text-muted)', padding: '6px 12px', fontSize: '13px' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button className="btn btn-sm btn-outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </AdminLayout>
  );
};