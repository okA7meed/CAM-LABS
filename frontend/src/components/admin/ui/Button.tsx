import React from 'react';
import { Icon, IconName } from '../../ui/Icon';

export const Button: React.FC<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  title?: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ variant = 'secondary', size = 'md', icon, disabled, loading, className, title, type = 'button', onClick, children }) => {
  const classes = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled || loading} title={title}>
      {loading ? <Icon name="loader" size={size === 'sm' ? 13 : 15} className="admin-spin" /> : icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
      {children}
    </button>
  );
};