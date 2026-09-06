import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { AdminLayout } from './AdminLayout';
import { StatCard } from './ui/StatCard';
import { AdminCard, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/States';

const SUMMARY_TONES: Record<string, 'blue' | 'green' | 'amber' | 'cyan' | 'purple' | 'magenta'> = {
  orders: 'blue',
  total: 'green',
  revenue: 'green',
  count: 'cyan',
  amount: 'purple',
};

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

  const summaryKey = (key: string): string => key.replace(/([A-Z])/g, ' $1').trim().toLowerCase();

  return (
    <AdminLayout title={t('admin.reports.title')} subtitle={t('admin.reports.subtitle')}>
      <div className="admin-section">
        <div className="admin-toolbar">
          <div className="admin-toolbar-filters">
            {reports.map((r) => (
              <Button
                key={r.key}
                variant={activeReport === r.key ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setActiveReport(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <div className="admin-toolbar-row">
            <span className="admin-filter admin-date-range">
              <Icon name="calendar" size={14} className="admin-filter-icon" />
              <input
                className="form-control"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))}
                aria-label={t('admin.lists.fromDate')}
              />
              <span className="admin-date-sep">{t('admin.lists.toDate')}</span>
              <input
                className="form-control"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))}
                aria-label={t('admin.lists.toDate')}
              />
            </span>
            <div className="admin-toolbar-actions">
              <Button variant="primary" size="sm" icon="reset" onClick={loadReport}>
                {t('admin.reports.apply')}
              </Button>
            </div>
          </div>
        </div>

        <AdminCard>
          <AdminCardBody>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--admin-text-muted)' }}>
                {t('admin.reports.loading')}
              </div>
            ) : data ? (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div className="admin-kpi-grid">
                  {Object.entries(data).filter(([_key, v]) => typeof v === 'number' || typeof v === 'string').slice(0, 6).map(([key, val]) => (
                    <StatCard
                      key={key}
                      title={key.replace(/([A-Z])/g, ' $1').trim()}
                      value={String(val)}
                      icon="database"
                      tone={SUMMARY_TONES[summaryKey(key)] ?? 'blue'}
                    />
                  ))}
                </div>

                {data.statusBreakdown && (
                  <div>
                    <h3 className="admin-card-title" style={{ marginBottom: '12px' }}>{t('admin.reports.statusBreakdown')}</h3>
                    <div className="admin-card-grid">
                      {Object.entries(data.statusBreakdown).map(([status, count]) => (
                        <div key={status}>
                          <div className="admin-detail-label">{statusLabel(status)}</div>
                          <div className="admin-detail-value" style={{ fontWeight: 600 }}>{String(count)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.technologyBreakdown && (
                  <div>
                    <h3 className="admin-card-title" style={{ marginBottom: '12px' }}>{t('admin.reports.technologyBreakdown')}</h3>
                    <div className="admin-card-grid">
                      {Object.entries(data.technologyBreakdown).map(([tech, count]) => (
                        <div key={tech}>
                          <div className="admin-detail-label">{tech}</div>
                          <div className="admin-detail-value" style={{ fontWeight: 600 }}>{String(count)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon="database" text={t('admin.reports.noData')} />
            )}
          </AdminCardBody>
        </AdminCard>
      </div>
    </AdminLayout>
  );
};