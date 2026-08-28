import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

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

  if (!selectedAdminQuoteId) {
    return <AdminLayout title={t('admin.quoteDetail.title')}><div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.quoteDetail.noSelected')}</div></AdminLayout>;
  }

  return (
    <AdminLayout title={`${t('admin.quoteDetail.title')} · ${selectedAdminQuoteId}`} subtitle={t('admin.quoteDetail.subtitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--cam-text-faint)' }}>{t('admin.quoteDetail.loading')}</div>
      ) : !quote ? (
        <div style={{ color: 'var(--cam-text-muted)' }}>{t('admin.quoteDetail.notFound')}</div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          <button className="btn btn-sm btn-outline" onClick={() => { closeAdminDetail(); setActiveView('admin-quotes'); }}>
            {t('admin.quoteDetail.backToQuotes')}
          </button>
          <Section title={t('admin.quoteDetail.quoteHeader')}>
            <Grid>
              <DetailItem label={t('admin.quoteDetail.quoteId')} value={quote.id} />
              <DetailItem label={t('admin.quoteDetail.customer')} value={quote.user?.name || '—'} />
              <DetailItem label={t('admin.quoteDetail.technology')} value={quote.technology} />
              <DetailItem label={t('admin.quoteDetail.material')} value={quote.material} />
              <DetailItem label={t('admin.quoteDetail.quantity')} value={quote.quantity} />
              <DetailItem label={t('admin.quoteDetail.price')} value={quote.totalPrice} />
              <DetailItem label={t('admin.quoteDetail.currency')} value="EGP" />
              <DetailItem label={t('admin.quoteDetail.created')} value={new Date(quote.createdAt).toLocaleString()} />
              <DetailItem label={t('admin.quoteDetail.expiry')} value={quote.validUntil || '—'} />
              <DetailItem label={t('admin.quoteDetail.equationVersion')} value={quote.pricingEquationVersion ? `v${quote.pricingEquationVersion.version}` : '—'} />
              <DetailItem label={t('admin.quoteDetail.convertedOrder')} value={quote.convertedOrderId || '—'} />
            </Grid>
          </Section>

          <Section title={t('admin.quoteDetail.pricingBreakdown')}>
            <pre style={{ color: 'var(--cam-text-secondary)', whiteSpace: 'pre-wrap' }}>{JSON.stringify(quote.pricingBreakdown || {}, null, 2)}</pre>
          </Section>

          <Section title={t('admin.quoteDetail.customerSection')}>
            <Grid>
              <DetailItem label={t('admin.quoteDetail.customerId')} value={quote.user?.id || '—'} />
              <DetailItem label={t('admin.quoteDetail.email')} value={quote.user?.email || '—'} />
              <DetailItem label={t('admin.quoteDetail.phone')} value={quote.user?.phone || '—'} />
              <DetailItem label={t('admin.quoteDetail.accountStatus')} value={quote.user?.accountStatus || '—'} />
            </Grid>
          </Section>
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
