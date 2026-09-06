import React from 'react';
import { Icon, IconName } from '../../ui/Icon';

export const EmptyState: React.FC<{
  icon?: IconName;
  text: string;
  hint?: string;
  actions?: React.ReactNode;
}> = ({ icon, text, hint, actions }) => (
  <div className="empty-state admin-empty" style={{ flexDirection: 'column', gap: hint || actions ? 12 : 0 }}>
    {icon && <Icon name={icon} size={26} />}
    <span>{text}</span>
    {hint && <span style={{ fontSize: 12.5, color: 'var(--admin-text-muted)' }}>{hint}</span>}
    {actions && <div className="admin-card-header-actions" style={{ marginTop: 2 }}>{actions}</div>}
  </div>
);

export const ErrorState: React.FC<{
  text: string;
  onRetry: () => void;
  retryLabel: string;
}> = ({ text, onRetry, retryLabel }) => (
  <div className="error-state admin-error-state">
    <span className="error-state-icon" aria-hidden="true"><Icon name="alert" size={22} /></span>
    <span className="error-state-title">{text}</span>
    <ButtonRetry label={retryLabel} onRetry={onRetry} />
  </div>
);

const ButtonRetry: React.FC<{ label: string; onRetry: () => void }> = ({ label, onRetry }) => (
  <button type="button" className="btn btn-sm btn-outline" onClick={onRetry}>
    {label}
  </button>
);

export const LoadingRows: React.FC<{ cols: number; rows?: number }> = ({ cols, rows = 6 }) => (
  <React.Fragment>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={rowIndex} className="admin-skeleton-row">
        {Array.from({ length: cols }).map((_, colIndex) => {
          const width = 62 + ((rowIndex * 7 + colIndex * 11) % 36);
          return (
            <td key={colIndex}>
              <span className="skeleton-block" style={{ width: `${width}%`, height: 14 }} />
            </td>
          );
        })}
      </tr>
    ))}
  </React.Fragment>
);