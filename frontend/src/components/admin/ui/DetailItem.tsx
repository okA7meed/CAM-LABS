import React from 'react';

export const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div className="admin-detail-label">{label}</div>
    <div className="admin-detail-value">{value || '—'}</div>
  </div>
);

export const DetailsGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="admin-card-grid">{children}</div>
);