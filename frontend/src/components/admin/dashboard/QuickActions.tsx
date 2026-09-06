import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, IconName } from '../../ui/Icon';
import { ViewType } from '../../../types';

interface QuickAction {
  view: ViewType;
  labelKey: string;
  descKey: string;
  icon: IconName;
  tone: 'tone-blue' | 'tone-green' | 'tone-amber' | 'tone-cyan' | 'tone-purple' | 'tone-magenta';
}

const ALL_ACTIONS: QuickAction[] = [
  { view: 'admin-orders', labelKey: 'admin.dashboard.manageOrders', descKey: 'admin.dashboard.qaDesc.orders', icon: 'layers', tone: 'tone-blue' },
  { view: 'admin-manufacturers', labelKey: 'admin.dashboard.manageManufacturers', descKey: 'admin.dashboard.qaDesc.manufacturers', icon: 'precision', tone: 'tone-magenta' },
  { view: 'admin-pricing', labelKey: 'admin.dashboard.managePricing', descKey: 'admin.dashboard.qaDesc.pricing', icon: 'gear', tone: 'tone-cyan' },
  { view: 'admin-customers', labelKey: 'admin.dashboard.manageCustomers', descKey: 'admin.dashboard.qaDesc.customers', icon: 'users', tone: 'tone-amber' },
  { view: 'admin-materials', labelKey: 'admin.dashboard.manageMaterials', descKey: 'admin.dashboard.qaDesc.materials', icon: 'database', tone: 'tone-green' },
  { view: 'admin-users', labelKey: 'admin.dashboard.manageAdminUsers', descKey: 'admin.dashboard.qaDesc.adminUsers', icon: 'shieldCheck', tone: 'tone-purple' },
];

const PRICING_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PRICING_ADMIN'];

export const QuickActions: React.FC<{ role?: string; onNavigate: (view: ViewType) => void }> = ({ role, onNavigate }) => {
  const { t } = useTranslation();

  const items = ALL_ACTIONS.filter((item) => {
    if (item.view === 'admin-users') return role === 'SUPER_ADMIN';
    if (item.view === 'admin-pricing') return Boolean(role && PRICING_ROLES.includes(role));
    return true;
  });

  return (
    <section className="widget" aria-label={t('admin.dashboard.quickActions')}>
      <div className="widget-header">
        <h2 className="widget-title">{t('admin.dashboard.quickActions')}</h2>
        <span className="widget-caption">{t('admin.dashboard.quickActionsHint')}</span>
      </div>
      <div className="qa-grid">
        {items.map((item) => (
          <button key={item.view} type="button" className={`qa-item ${item.tone}`} onClick={() => onNavigate(item.view)}>
            <span className="qa-icon" aria-hidden="true">
              <Icon name={item.icon} size={17} />
            </span>
            <span className="qa-text">
              <span className="qa-label">{t(item.labelKey)}</span>
              <span className="qa-desc">{t(item.descKey)}</span>
            </span>
            <span className="qa-chev" aria-hidden="true">
              <Icon name="chevronRight" size={13} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};