import React from 'react';

export const TechBadge: React.FC<{ label: string; title?: string }> = ({ label, title }) => (
  <span className="badge badge-tech" title={title}>
    {label}
  </span>
);