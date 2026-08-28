import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { AdminLayout } from './AdminLayout';

export const AdminReportsView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();
  const [activeReport, setActiveReport] = useState('orders');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set('startDate', dateRange.start);
      if (dateRange.end) params.set('endDate', dateRange.end);
      const res = await fetch(`/api/v1/admin/reports/${activeReport}?${params}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load report');
      const result = await res.json();
      setData(result.data);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadReport(); }, [activeReport]);

  const reports = [
    { key: 'orders', label: t('admin.reports.ordersReport') },
    { key: 'revenue', label: t('admin.reports.revenueReport') },
    { key: 'manufacturing', label: t('admin.reports.manufacturingReport') },
    { key: 'customers', label: t('admin.reports.customerReport') },
    { key: 'materials', label: t('admin.reports.materialUsage') },
    { key: 'quotes', label: t('admin.reports.quoteConversion') },
    { key: 'cad-uploads', label: t('admin.reports.cadUploads') },
  ];

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'In Review': return t('admin.status.inReview');
      case 'In Production': return t('admin.status.inProduction');
      case 'Quality Inspection': return t('admin.status.qualityInspection');
      case 'Delivered': return t('admin.status.delivered');
      case 'Cancelled': return t('admin.status.cancelled');
      case 'Pending': return t('admin.status.pending');
      case 'Completed': return t('admin.status.completed');
      case 'Approved': return t('admin.status.approved');
      default: return status;
    }
  };

  return (
    <AdminLayout title={t('admin.reports.title')} subtitle={t('admin.reports.subtitle')}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {reports.map((r) => (
          <button
            key={r.key}
            className={`btn btn-sm ${activeReport === r.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveReport(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <input type="date" className="form-control" value={dateRange.start} onChange={(e) => setDateRange(d => ({ ...d, start: e.target.value }))}
          style={{ padding: '6px 10px', background: 'var(--cam-surface-2)', border: '1px solid var(--cam-border-subtle)', borderRadius: '6px', color: 'var(--cam-text-primary)' }} />
        <input type="date" className="form-control" value={dateRange.end} onChange={(e) => setDateRange(d => ({ ...d, end: e.target.value }))}
          style={{ padding: '6px 10px', background: 'var(--cam-surface-2)', border: '1px solid var(--cam-border-subtle)', borderRadius: '6px', color: 'var(--cam-text-primary)' }} />
        <button className="btn btn-sm btn-primary" onClick={loadReport}><Icon name="reset" size={14} /> {t('admin.reports.apply')}</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--cam-text-faint)' }}>{t('admin.reports.loading')}</div>
      ) : data ? (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {Object.entries(data).filter(([_key, v]) => typeof v === 'number' || typeof v === 'string').slice(0, 6).map(([key, val]) => (
              <div key={key} style={{ padding: '16px', background: 'var(--cam-surface-1)', borderRadius: '8px', border: '1px solid var(--cam-border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--cam-text-faint)', textTransform: 'capitalize', marginBottom: '4px' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--cam-text-primary)' }}>{String(val)}</div>
              </div>
            ))}
          </div>

          {/* Breakdown tables */}
          {data.statusBreakdown && (
            <div style={{ background: 'var(--cam-surface-1)', borderRadius: '8px', border: '1px solid var(--cam-border-subtle)', padding: '16px' }}>
              <h4 style={{ color: 'var(--cam-text-secondary)', marginBottom: '12px', fontSize: '14px' }}>{t('admin.reports.statusBreakdown')}</h4>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {Object.entries(data.statusBreakdown).map(([status, count]) => (
                  <div key={status} style={{ padding: '8px 16px', background: 'var(--cam-surface-2)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--cam-text-muted)', fontSize: '12px' }}>{statusLabel(status)}: </span>
                    <strong style={{ color: 'var(--cam-text-primary)' }}>{String(count)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.technologyBreakdown && (
            <div style={{ background: 'var(--cam-surface-1)', borderRadius: '8px', border: '1px solid var(--cam-border-subtle)', padding: '16px' }}>
              <h4 style={{ color: 'var(--cam-text-secondary)', marginBottom: '12px', fontSize: '14px' }}>{t('admin.reports.technologyBreakdown')}</h4>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {Object.entries(data.technologyBreakdown).map(([tech, count]) => (
                  <div key={tech} style={{ padding: '8px 16px', background: 'var(--cam-surface-2)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--cam-text-muted)', fontSize: '12px' }}>{tech}: </span>
                    <strong style={{ color: 'var(--cam-text-primary)' }}>{String(count)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--cam-text-faint)' }}>{t('admin.reports.noData')}</div>
      )}
    </AdminLayout>
  );
};