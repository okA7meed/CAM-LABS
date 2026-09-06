import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardHeader, AdminCardBody } from './ui/Card';
import { EmptyState } from './ui/States';

export const AdminShippingView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <AdminLayout title={t('admin.shipping.title')} subtitle={t('admin.shipping.subtitle')}>
      <div className="admin-section">
        <AdminCard>
          <AdminCardHeader title={t('admin.shipping.title')} description={t('admin.shipping.subtitle')} />
          <AdminCardBody>
            <EmptyState icon="mapPin" text={t('admin.shipping.notAvailable')} hint={t('admin.shipping.description')} />
          </AdminCardBody>
        </AdminCard>
      </div>
    </AdminLayout>
  );
};