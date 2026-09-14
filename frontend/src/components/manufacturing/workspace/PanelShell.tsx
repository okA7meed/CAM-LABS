import { ReactNode } from 'react';
import { Icon, IconName } from '../../ui/Icon';
import { PanelStatus } from './types';

export interface PanelShellProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  status?: PanelStatus;
  id?: string;
  className?: string;
  action?: ReactNode;
  hideStateMark?: boolean;
  children: ReactNode;
}

export const PanelShell = ({ icon, title, subtitle, status, id, className, action, hideStateMark, children }: PanelShellProps) => (
  <section id={id} tabIndex={-1} className={`mw-panel ${status ? `is-${status}` : ''} ${className || ''}`}>
    <header className="mw-panel-header">
      {!hideStateMark && status === 'completed' && (
        <span className="mw-panel-state-mark is-completed" aria-hidden="true"><Icon name="check" size={11} /></span>
      )}
      <span className="mw-panel-head-icon" aria-hidden="true"><Icon name={icon} size={16} /></span>
      <div className="mw-panel-head-text">
        <div className="mw-panel-title">{title}</div>
        {subtitle && <div className="mw-panel-subtitle">{subtitle}</div>}
      </div>
      {!hideStateMark && status === 'active' && <span className="mw-panel-state-mark is-now" aria-hidden="true" />}
      {action && <div className="mw-panel-action">{action}</div>}
    </header>
    <div className="mw-panel-body">{children}</div>
  </section>
);