import React from 'react';

/**
 * Tiny inline sparkline rendered from real historical values.
 * Returns null when there is no history at all — it must never invent a trend.
 * Sparse real values (days with zeros) are drawn truthfully as flat dips.
 */
export const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  const w = 96;
  const h = 30;

  if (values.length < 2 || Math.max(...values) <= 0) return null;

  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const points = values.map((value, index) => [index * step, h - 2 - (value / max) * (h - 4)]);
  const line = `M${points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L')}`;
  const area = `${line} L ${w},${h} L 0,${h} Z`;

  return (
    <svg className="kpi-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--kpi-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--kpi-accent)" stopOpacity="0" />
        </linearGradient>
        <filter id="sparkglow" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
      <path d={area} fill="url(#sparkfill)" />
      <path d={line} fill="none" stroke="var(--kpi-accent)" opacity="0.35" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" filter="url(#sparkglow)" />
      <path d={line} fill="none" stroke="var(--kpi-accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};