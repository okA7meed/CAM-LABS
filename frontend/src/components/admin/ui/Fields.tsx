import React from 'react';
import { Icon, IconName } from '../../ui/Icon';

export const AdminSearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  clearLabel: string;
}> = ({ value, onChange, placeholder, ariaLabel, clearLabel }) => (
  <div className="admin-search">
    <Icon name="search" size={15} className="admin-search-icon" />
    <input
      className="form-control"
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
    {value && (
      <button type="button" className="admin-search-clear" onClick={() => onChange('')} aria-label={clearLabel}>
        <Icon name="close" size={13} />
      </button>
    )}
  </div>
);

export const AdminFilterSelect: React.FC<{
  icon?: IconName;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  options: Array<{ value: string; label: string }>;
}> = ({ icon, value, onChange, ariaLabel, options }) => (
  <span className="admin-filter">
    {icon && <Icon name={icon} size={14} className="admin-filter-icon" />}
    <select className="form-control" value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </span>
);

export const AdminDateRangeFilter: React.FC<{
  fromLabel: string;
  toLabel: string;
  startDate: string;
  endDate: string;
  onChange: (patch: { startDate: string; endDate: string }) => void;
}> = ({ fromLabel, toLabel, startDate, endDate, onChange }) => (
  <span className="admin-filter admin-date-range">
    <Icon name="calendar" size={14} className="admin-filter-icon" />
    <input
      className="form-control"
      type="date"
      value={startDate}
      max={endDate || undefined}
      onChange={(e) => onChange({ startDate: e.target.value, endDate })}
      aria-label={fromLabel}
    />
    <span className="admin-date-sep">{toLabel}</span>
    <input
      className="form-control"
      type="date"
      value={endDate}
      min={startDate || undefined}
      onChange={(e) => onChange({ startDate, endDate: e.target.value })}
      aria-label={toLabel}
    />
  </span>
);