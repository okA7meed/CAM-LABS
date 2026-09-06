import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardHeader, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { DetailsGrid, DetailItem } from './ui/DetailItem';
import { EmptyState } from './ui/States';
import { StatusBadge, StatusTone } from './ui/StatusBadge';

const ACCOUNT_TONES: Record<string, StatusTone> = {
  ACTIVE: 'delivered',
  DISABLED: 'unknown',
  SUSPENDED: 'cancelled',
};

const ORDER_TONES: Record<string, StatusTone> = {
  'In Review': 'review',
  'In Production': 'production',
  'Ready for Approval': 'review',
  'Quality Inspection': 'inspection',
  'Delivered': 'delivered',
  'Completed': 'delivered',
  'Cancelled': 'cancelled',
  'Approved': 'delivered',
  'Pending': 'review',
};

const QUOTE_TONES: Record<string, StatusTone> = {
  'Ready for Approval': 'review',
  'Approved': 'delivered',
  'Rejected': 'cancelled',
  'Revised': 'review',
  'Draft': 'unknown',
  'Expired': 'unknown',
};

const FILE_TONES: Record<string, StatusTone> = {
  'Verified CAD': 'delivered',
  'Analyzing': 'review',
  'DFM Flagged': 'inspection',
  'Quarantined': 'cancelled',
  'Processing Failed': 'cancelled',
};

const roleLabel = (role: string): string => {
  if (/superadmin/i.test(role)) return role;
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
};

const TAB_VALUES = ['overview', 'orders', 'quotes', 'cad', 'activity'] as const;
type TabValue = (typeof TAB_VALUES)[number];

export const AdminCustomerDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAdminCustomerId, closeAdminDetail, setActiveView, showToast } = useStore();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>('overview');

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

  const accountStatusLabel = (value: string): string => {
    switch (value) {
      case 'ACTIVE': return t('admin.status.active');
      case 'DISABLED': return t('admin.status.disabled');
      case 'SUSPENDED': return t('admin.status.suspended');
      default: return value;
    }
  };

  const tabLabels: Record<TabValue, string> = {
    overview: t('admin.customerDetail.overview'),
    orders: t('admin.customerDetail.orders'),
    quotes: t('admin.customerDetail.quotes'),
    cad: t('admin.customerDetail.cadFiles'),
    activity: t('admin.customerDetail.activity'),
  };

  const spending = useMemo(() => {
    const orders = customer?.orders || [];
    return orders.reduce((sum: number, order: any) => sum + (parseFloat(String(order.totalCost).replace(/[^0-9.-]+/g, '')) || 0), 0);
  }, [customer]);

  if (!selectedAdminCustomerId) {
    return (
      <AdminLayout title={t('admin.customerDetail.title')}>
        <div className="admin-section">
          <EmptyState icon="network" text={t('admin.customerDetail.noSelected')} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`${t('admin.customerDetail.title')} · ${selectedAdminCustomerId}`} subtitle={t('admin.customerDetail.subtitle')}>
      <div className="admin-section">
        {loading ? (
          <div className="admin-muted" style={{ textAlign: 'center', padding: '60px 0' }}>{t('admin.customerDetail.loading')}</div>
        ) : !customer ? (
          <EmptyState icon="network" text={t('admin.customerDetail.notFound')} />
        ) : (
          <>
            <AdminCard>
              <AdminCardHeader
                title={customer.name || customer.id}
                description={customer.email || customer.id}
                actions={
                  <>
                    <StatusBadge status={accountStatusLabel(customer.accountStatus)} tone={ACCOUNT_TONES[customer.accountStatus] ?? 'unknown'} />
                    <span className="badge badge-neutral">{roleLabel(customer.role || '')}</span>
                    <Button variant="outline" size="sm" icon="arrowLeft" onClick={() => { closeAdminDetail(); setActiveView('admin-customers'); }}>
                      {t('admin.customerDetail.backToCustomers')}
                    </Button>
                  </>
                }
              />
            </AdminCard>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TAB_VALUES.map((value) => (
                <Button key={value} variant={tab === value ? 'primary' : 'outline'} size="sm" onClick={() => setTab(value)}>
                  {tabLabels[value]}
                </Button>
              ))}
            </div>

            {tab === 'overview' && (
              <AdminCard>
                <AdminCardHeader title={tabLabels.overview} />
                <AdminCardBody>
                  <DetailsGrid>
                    <DetailItem label={t('admin.customerDetail.customerId')} value={customer.id} />
                    <DetailItem label={t('admin.customerDetail.name')} value={customer.name} />
                    <DetailItem label={t('admin.customerDetail.email')} value={customer.email} />
                    <DetailItem label={t('admin.customerDetail.phone')} value={customer.phone || '—'} />
                    <DetailItem label={t('admin.customerDetail.registrationDate')} value={new Date(customer.createdAt).toLocaleString()} />
                    <DetailItem label={t('admin.customerDetail.totalOrders')} value={customer.orders?.length || 0} />
                    <DetailItem label={t('admin.customerDetail.totalSpending')} value={`${spending.toFixed(2)} EGP`} />
                  </DetailsGrid>
                </AdminCardBody>
              </AdminCard>
            )}

            {tab === 'orders' && (
              <AdminCard>
                <AdminCardHeader title={tabLabels.orders} />
                <AdminCardBody flush>
                  {customer.orders?.length ? (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('admin.orderDetail.orderId')}</th>
                            <th>{t('admin.orders.col.part')}</th>
                            <th>{t('admin.orders.col.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customer.orders.map((order: any) => (
                            <tr key={order.id}>
                              <td className="mono-primary">{order.id}</td>
                              <td>{order.partName || '—'}</td>
                              <td><StatusBadge status={order.status} tone={ORDER_TONES[order.status] ?? 'unknown'} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState icon="cube" text={t('admin.lists.empty')} />
                  )}
                </AdminCardBody>
              </AdminCard>
            )}

            {tab === 'quotes' && (
              <AdminCard>
                <AdminCardHeader title={tabLabels.quotes} />
                <AdminCardBody flush>
                  {customer.quotes?.length ? (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('admin.quoteDetail.quoteId')}</th>
                            <th>{t('admin.orders.col.part')}</th>
                            <th>{t('admin.orders.col.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customer.quotes.map((quote: any) => (
                            <tr key={quote.id}>
                              <td className="mono-primary">{quote.id}</td>
                              <td>{quote.partName || '—'}</td>
                              <td><StatusBadge status={quote.status} tone={QUOTE_TONES[quote.status] ?? 'unknown'} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState icon="clipboard" text={t('admin.lists.empty')} />
                  )}
                </AdminCardBody>
              </AdminCard>
            )}

            {tab === 'cad' && (
              <AdminCard>
                <AdminCardHeader title={tabLabels.cad} />
                <AdminCardBody flush>
                  {customer.cadFiles?.length ? (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('admin.cadFileDetail.fileName')}</th>
                            <th>{t('admin.cadFiles.format')}</th>
                            <th>{t('admin.orders.col.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customer.cadFiles.map((cad: any) => (
                            <tr key={cad.id}>
                              <td className="mono-primary">{cad.name}</td>
                              <td><span className="badge badge-neutral">{cad.format}</span></td>
                              <td><StatusBadge status={cad.status} tone={FILE_TONES[cad.status] ?? 'unknown'} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState icon="file" text={t('admin.lists.empty')} />
                  )}
                </AdminCardBody>
              </AdminCard>
            )}

            {tab === 'activity' && (
              <AdminCard>
                <AdminCardHeader title={tabLabels.activity} />
                <AdminCardBody>
                  <div className="admin-muted">{t('admin.customerDetail.activityDescription')}</div>
                </AdminCardBody>
              </AdminCard>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};