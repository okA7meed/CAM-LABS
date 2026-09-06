import React from 'react';
import { Icon, IconName } from '../../ui/Icon';
import { Sparkline } from '../dashboard/Sparkline';

export type KpiTone = 'blue' | 'green' | 'amber' | 'cyan' | 'purple' | 'magenta';

export const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: IconName;
  tone: KpiTone;
  spark?: number[];
}> = ({ title, value, subtitle, icon, tone, spark }) => (
  <div className={`kpi-card tone-${tone}`}>
    <div className="kpi-top">
      <span className="kpi-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="kpi-label">{title}</span>
      {spark && spark.length > 0 && <Sparkline values={spark} />}
    </div>
    <span className="kpi-value">{value}</span>
    {subtitle && <span className="kpi-sub">{subtitle}</span>}
  </div>
);