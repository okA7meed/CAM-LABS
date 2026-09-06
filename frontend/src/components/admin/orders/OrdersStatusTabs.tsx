import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderStats } from './types';
import { ORDER_STATUS_TABS } from './types';

interface OrdersStatusTabsProps {
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  stats: OrderStats;
}

export const OrdersStatusTabs: React.FC<OrdersStatusTabsProps> = ({ activeTab, onTabChange, stats }) => {
  const { t } = useTranslation();

  return (
    <div className="orders-status-tabs">
      <div className="orders-tabs-list">
        {ORDER_STATUS_TABS.map((tab) => {
          const count = (stats[tab.countKey as keyof OrderStats] as number) ?? 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={`orders-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => onTabChange(tab.key)}
              aria-pressed={isActive}
            >
              <span className="orders-tab-label">{t(tab.labelKey)}</span>
              <span className="orders-tab-count">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};