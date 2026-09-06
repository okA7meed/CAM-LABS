import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardHeader, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { DetailsGrid, DetailItem } from './ui/DetailItem';
import { EmptyState } from './ui/States';
import { StatusBadge, StatusTone } from './ui/StatusBadge';
import { TechBadge } from './ui/TechBadge';

const ACCOUNT_TONES: Record<string, StatusTone> = {
  ACTIVE: 'delivered',
  DISABLED: 'unknown',
  SUSPENDED: 'cancelled',
};

export const AdminQuoteDetailView: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAdminQuoteId, closeAdminDetail, setActiveView, showToast } = useStore();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!selectedAdminQuoteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/quotes/${selectedAdminQuoteId}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load quote');
      const data = await res.json();
      setQuote(data.data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load quote details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedAdminQuoteId]);

  const accountStatusLabel = (value: string): string => {
    switch (value) {
      case 'ACTIVE': return t('admin.status.active');
      case 'DISABLED': return t('admin.status.disabled');
      case 'SUSPENDED': return t('admin.status.suspended');
      default: return value;
    }
  };

  if (!selectedAdminQuoteId) {
    return (
      <AdminLayout title={t('admin.quoteDetail.title')}>
        <div className="admin-section">
          <EmptyState icon="clipboard" text={t('admin.quoteDetail.noSelected')} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`${t('admin.quoteDetail.title')} · ${selectedAdminQuoteId}`} subtitle={t('admin.quoteDetail.subtitle')}>
      <div className="admin-section">
        {loading ? (
          <div className="admin-muted" style={{ textAlign: 'center', padding: '60px 0' }}>{t('admin.quoteDetail.loading')}</div>
        ) : !quote ? (
          <EmptyState icon="clipboard" text={t('admin.quoteDetail.notFound')} />
        ) : (
          <>
            <AdminCard>
              <AdminCardHeader
                title={quote.id}
                description={quote.partName || quote.technology}
                actions={
                  <Button variant="outline" size="sm" icon="arrowLeft" onClick={() => { closeAdminDetail(); setActiveView('admin-quotes'); }}>
                    {t('admin.quoteDetail.backToQuotes')}
                  </Button>
                }
              />
              <AdminCardBody>
                <DetailsGrid>
                  <DetailItem label={t('admin.quoteDetail.quoteId')} value={quote.id} />
                  <DetailItem label={t('admin.quoteDetail.customer')} value={quote.user?.name || '—'} />
                  <DetailItem label={t('admin.quoteDetail.technology')} value={<TechBadge label={quote.technology} title={quote.technology} />} />
                  <DetailItem label={t('admin.quoteDetail.material')} value={quote.material} />
                  <DetailItem label={t('admin.quoteDetail.quantity')} value={quote.quantity} />
                  <DetailItem label={t('admin.quoteDetail.price')} value={quote.totalPrice} />
                  <DetailItem label={t('admin.quoteDetail.currency')} value="EGP" />
                  <DetailItem label={t('admin.quoteDetail.created')} value={new Date(quote.createdAt).toLocaleString()} />
                  <DetailItem label={t('admin.quoteDetail.expiry')} value={quote.validUntil || '—'} />
                  <DetailItem label={t('admin.quoteDetail.equationVersion')} value={quote.pricingEquationVersion ? `v${quote.pricingEquationVersion.version}` : '—'} />
                  <DetailItem label={t('admin.quoteDetail.convertedOrder')} value={quote.convertedOrderId || '—'} />
                </DetailsGrid>
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.quoteDetail.pricingBreakdown')} />
              <AdminCardBody>
                <pre className="admin-muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(quote.pricingBreakdown || {}, null, 2)}</pre>
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader title={t('admin.quoteDetail.customerSection')} />
              <AdminCardBody>
                <DetailsGrid>
                  <DetailItem label={t('admin.quoteDetail.customerId')} value={quote.user?.id || '—'} />
                  <DetailItem label={t('admin.quoteDetail.email')} value={quote.user?.email || '—'} />
                  <DetailItem label={t('admin.quoteDetail.phone')} value={quote.user?.phone || '—'} />
                  <DetailItem
                    label={t('admin.quoteDetail.accountStatus')}
                    value={quote.user?.accountStatus
                      ? <StatusBadge status={accountStatusLabel(quote.user.accountStatus)} tone={ACCOUNT_TONES[quote.user.accountStatus] ?? 'unknown'} />
                      : '—'}
                  />
                </DetailsGrid>
              </AdminCardBody>
            </AdminCard>
          </>
        )}
      </div>
    </AdminLayout>
  );
};