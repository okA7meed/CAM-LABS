import React from 'react';

export type StatusTone = 'review' | 'production' | 'inspection' | 'delivered' | 'cancelled' | 'unknown';

const DEFAULT_TONES: Record<string, StatusTone> = {
  'In Review': 'review',
  'In Production': 'production',
  'Quality Inspection': 'inspection',
  'Delivered': 'delivered',
  'Cancelled': 'cancelled',
  'Completed': 'delivered',
  'Approved': 'delivered',
  'Pending': 'review',
  'Paid': 'delivered',
  'Refunded': 'inspection',
  'Failed': 'cancelled',
  'Partially Refunded': 'inspection',
  'Ready for Approval': 'review',
  'Submitted': 'review',
  'Active': 'delivered',
  'Available': 'delivered',
  'Verified': 'delivered',
  'Verified CAD': 'delivered',
  'Inactive': 'unknown',
  'Disabled': 'unknown',
  'Suspended': 'cancelled',
  'Busy': 'review',
  'Offline': 'unknown',
  'processingFailed': 'cancelled',
  'quarantined': 'cancelled',
};

export const statusToneOf = (status: string): StatusTone => DEFAULT_TONES[status] ?? 'unknown';

export const StatusBadge: React.FC<{ status: string; tone?: StatusTone; dot?: boolean }> = ({
  status,
  tone,
  dot = true,
}) => {
  const resolved = tone ?? statusToneOf(status);
  return (
    <span className={`status-badge status-${resolved}`}>
      {dot && <span className={`status-dot status-${resolved}`} />}
      {status}
    </span>
  );
};