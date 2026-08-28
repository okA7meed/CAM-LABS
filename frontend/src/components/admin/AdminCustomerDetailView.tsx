import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminCustomerDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAdminCustomerId, closeAdminDetail, setActiveView, showToast } = useStore();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'orders' | 'quotes' | 'cad' | 'activity'>('overview');

  const load = async () => {
    if (!selectedAdminCustomerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/customers/${selectedAdminCustomerId}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load customer');
      const data = await res.json();
      setCustomer(data.data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load customer details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedAdminCustomerId]);

  const spending = useMemo(() => {
    const orders = customer?.orders || [];
    return orders.reduce((sum: number, order: any) => sum + (parseFloat(String(order.totalCost).replace(/[^0-9.-]+/g, '')) || 0), 0);
  }, [customer]);

  if (!selectedAdminCustomerId) {
    return <AdminLayout title={t('admin.customerDetail.title')}><div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.customerDetail.noSelected')}</div></AdminLayout>;
  }

  const tabLabels: Record<string, string> = {
    overview: t('admin.customerDetail.overview'),
    orders: t('admin.customerDetail.orders'),
    quotes: t('admin.customerDetail.quotes'),
    cad: t('admin.customerDetail.cadFiles'),
    activity: t('admin.customerDetail.activity'),
  };

  return (
    <AdminLayout title={`${t('admin.customerDetail.title')} · ${selectedAdminCustomerId}`} subtitle={t('admin.customerDetail.subtitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--cam-text-faint)' }}>{t('admin.customerDetail.loading')}</div>
      ) : !customer ? (
        <div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.customerDetail.notFound')}</div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <button className="btn btn-sm btn-outline" onClick={() => { closeAdminDetail(); setActiveView('admin-customers'); }}>
              {t('admin.customerDetail.backToCustomers')}
            </button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="badge badge-primary">{customer.accountStatus}</span>
              <span className="badge badge-neutral">{customer.role}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['overview', 'orders', 'quotes', 'cad', 'activity'] as const).map((value) => (
              <button key={value} className={`btn btn-sm ${tab === value ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(value)}>
                {tabLabels[value]}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <Section title={t('admin.customerDetail.overview')}>
              <Grid>
                <DetailItem label={t('admin.customerDetail.customerId')} value={customer.id} />
                <DetailItem label={t('admin.customerDetail.name')} value={customer.name} />
                <DetailItem label={t('admin.customerDetail.email')} value={customer.email} />
                <DetailItem label={t('admin.customerDetail.phone')} value={customer.phone || '—'} />
                <DetailItem label={t('admin.customerDetail.registrationDate')} value={new Date(customer.createdAt).toLocaleString()} />
                <DetailItem label={t('admin.customerDetail.totalOrders')} value={customer.orders?.length || 0} />
                <DetailItem label={t('admin.customerDetail.totalSpending')} value={`${spending.toFixed(2)} EGP`} />
              </Grid>
            </Section>
          )}

          {tab === 'orders' && <ListSection title={t('admin.customerDetail.orders')} items={customer.orders || []} renderItem={(order) => <div><strong>{order.id}</strong> · {order.partName} · {order.status}</div>} />}
          {tab === 'quotes' && <ListSection title={t('admin.customerDetail.quotes')} items={customer.quotes || []} renderItem={(quote) => <div><strong>{quote.id}</strong> · {quote.partName} · {quote.status}</div>} />}
          {tab === 'cad' && <ListSection title={t('admin.customerDetail.cadFiles')} items={customer.cadFiles || []} renderItem={(cad) => <div><strong>{cad.name}</strong> · {cad.format} · {cad.status}</div>} />}
          {tab === 'activity' && (
            <Section title={t('admin.customerDetail.activity')}>
              <div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.customerDetail.activityDescription')}</div>
            </Section>
          )}
        </div>
      )}
    </AdminLayout>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="dashboard-section-panel" style={{ padding: '20px' }}>
    <h3 style={{ marginBottom: '12px', color: 'var(--cam-text-primary)' }}>{title}</h3>
    {children}
  </div>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>{children}</div>
);

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: '11px', color: 'var(--cam-text-faint)', marginBottom: '6px' }}>{label}</div>
    <div style={{ color: 'var(--cam-text-primary)' }}>{value || '—'}</div>
  </div>
);

const ListSection: React.FC<{ title: string; items: any[]; renderItem: (item: any) => React.ReactNode }> = ({ title, items, renderItem }) => (
  <Section title={title}>
    <div style={{ display: 'grid', gap: '10px' }}>
      {items.map((item) => (
        <div key={item.id} style={{ padding: '12px', borderRadius: '8px', background: 'var(--cam-surface-1)' }}>{renderItem(item)}</div>
      ))}
      {items.length === 0 && <div style={{ color: 'var(--cam-text-muted)' }}>No records found.</div>}
    </div>
  </Section>
);
