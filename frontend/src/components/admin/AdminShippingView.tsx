import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from './AdminLayout';

export const AdminShippingView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <AdminLayout title={t('admin.shipping.title')} subtitle={t('admin.shipping.subtitle')}>
      <div
        style={{
          background: 'var(--cam-surface-1)',
          border: '1px solid var(--cam-border-subtle)',
          borderRadius: '12px',
          padding: '60px 24px',
          textAlign: 'center',
          color: 'var(--cam-text-muted)',
        }}
      >
        <div style={{ fontSize: '14px', marginBottom: '12px' }}>
          {t('admin.shipping.notAvailable')}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--cam-text-faint)' }}>
          {t('admin.shipping.description')}
        </div>
      </div>
    </AdminLayout>
  );
};
