import React from 'react';

export const AdminCard: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={`admin-card ${className ?? ''}`.trim()}>{children}</div>
);

export const AdminCardHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({
  title,
  description,
  actions,
}) => (
  <div className="admin-card-header">
    <div style={{ minWidth: 0 }}>
      <h3 className="admin-card-title">{title}</h3>
      {description && <p className="admin-card-desc">{description}</p>}
    </div>
    {actions && <div className="admin-card-header-actions">{actions}</div>}
  </div>
);

export const AdminCardBody: React.FC<{ children: React.ReactNode; flush?: boolean }> = ({ children, flush }) => (
  <div className={flush ? 'admin-card-body-flush' : 'admin-card-body'}>{children}</div>
);

export const AdminCardFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="admin-card-footer">{children}</div>
);