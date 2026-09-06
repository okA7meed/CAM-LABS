import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface OrderChartPoint {
  date: string;
  orders: number;
}

const H = 196;
const PAD = { top: 16, right: 12, bottom: 26, left: 8 };

const dayLabel = (iso: string, locale: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
};

const smoothPath = (pts: Array<{ x: number; y: number }>): string => {
  if (pts.length < 3) return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L');
  const d = [`M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d.push(
      `C ${(p1.x + (p2.x - p0.x) / 6).toFixed(2)},${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ` +
        `${(p2.x - (p3.x - p1.x) / 6).toFixed(2)},${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`,
    );
  }
  return d.join(' ');
};

export const OrderChart: React.FC<{ data: OrderChartPoint[]; emptyLabel: string }> = ({ data, emptyLabel }) => {
  const { i18n } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasData = data.some((point) => point.orders > 0);
  if (!hasData) {
    return (
      <div className="chart-empty" ref={wrapRef} role="img" aria-label={emptyLabel}>
        <span className="chart-empty-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 17l5-6 4 3 5-8 4 5" />
          </svg>
        </span>
        <span>{emptyLabel}</span>
      </div>
    );
  }

  const max = Math.max(...data.map((point) => point.orders), 1);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;
  const xAt = (i: number) => PAD.left + (data.length > 1 ? i * step : plotW / 2);
  const yAt = (value: number) => PAD.top + plotH - (value / max) * plotH;

  const pts = data.map((point, i) => ({ x: xAt(i), y: yAt(point.orders) }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(2)},${H - PAD.bottom} L ${pts[0].x.toFixed(2)},${H - PAD.bottom} Z`;

  const tickCount = Math.min(5, Math.max(2, Math.floor((width - 8) / 72)));
  const tickIndexes = Array.from({ length: tickCount }, (_, k) =>
    Math.round(((data.length - 1) * k) / Math.max(1, tickCount - 1)),
  );
  const gridValues = [0, Math.round(max / 2), max];

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={emptyLabel}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const px = event.clientX - rect.left;
            const i = Math.round((px - PAD.left) / (step || 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="ordfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--admin-blue)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--admin-blue)" stopOpacity="0" />
            </linearGradient>
            <filter id="ordglow" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yAt(value)}
                y2={yAt(value)}
                stroke="var(--admin-border)"
                strokeDasharray="3 4"
              />
              <text x={width - PAD.right} y={yAt(value) - 3} textAnchor="end" className="chart-y-label">
                {value}
              </text>
            </g>
          ))}

          <path d={area} fill="url(#ordfill)" />
          <path d={line} fill="none" stroke="var(--admin-blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" filter="url(#ordglow)" />

          <g>
            {pts.map((point, i) =>
              i === hover ? null : (
                <circle key={i} cx={point.x} cy={point.y} r={2.6} fill="var(--admin-blue)" opacity={point.y >= yAt(max) - 1 ? 0.9 : 0.55} />
              ),
            )}
          </g>

          {hover !== null && pts[hover] && (
            <g>
              <line x1={pts[hover].x} x2={pts[hover].x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--admin-blue)" strokeWidth="1" opacity="0.35" />
              <circle cx={pts[hover].x} cy={pts[hover].y} r={4.5} fill="var(--admin-blue)" opacity="0.25" />
              <circle cx={pts[hover].x} cy={pts[hover].y} r={3} fill="var(--admin-blue)" />
            </g>
          )}

          {tickIndexes.map((i) => (
            <text key={i} x={xAt(i)} y={H - 7} textAnchor="middle" className="chart-x-label">
              {dayLabel(data[i].date, i18n.language)}
            </text>
          ))}
        </svg>
      )}

      {active && width > 0 && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(pts[hover!].x - 44, 4), Math.max(width - 96, 4)),
            top: Math.max(pts[hover!].y - 58, 6),
          }}
          role="status"
        >
          <span className="chart-tooltip-date">{dayLabel(active.date, i18n.language)}</span>
          <span className="chart-tooltip-value">{active.orders}</span>
        </div>
      )}
    </div>
  );
};