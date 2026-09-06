import React from 'react';
import { useTranslation } from 'react-i18next';
import { EquationBuilderView } from './EquationBuilderView';
import { AdminLayout } from './AdminLayout';

export const AdminPricingView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <AdminLayout title={t('admin.pricing.title')} subtitle={t('admin.pricing.subtitle')}>
      <div className="admin-section">
        <EquationBuilderView />
      </div>
    </AdminLayout>
  );
};