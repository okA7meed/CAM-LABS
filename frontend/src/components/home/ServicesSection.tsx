import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal, ScrollReveal, StaggerReveal } from '../ui/Reveal';

interface ServiceDefinition {
  id: string;
  translationId: 'industrial3d' | 'fdm' | 'cnc' | 'sheet' | 'tooling';
  title: string;
  category: string;
  description: string;
  materialRef?: string;
  techTags: string[];
  specs: {
    tolerance: string;
    leadTime: string;
    keyMetricLabel: string;
    keyMetricValue: string;
    standard: string;
  };
  iconSvg: React.ReactNode;
}

const SERVICES_CATALOG: ServiceDefinition[] = [
  {
    id: '3d-printing-industrial',
    translationId: 'industrial3d',
    title: 'Industrial 3D Printing',
    category: 'Additive Manufacturing',
    description: 'High-density laser sintering (SLS) and high-resolution stereolithography (SLA) for production-grade polymers and isotropic mechanical strength.',
    materialRef: 'pa12-sls',
    techTags: ['SLS Nylon 12', 'SLA Tough 100', 'DMLS Metal', 'No Tooling'],
    specs: {
      tolerance: '± 0.08 mm',
      leadTime: 'From 24 Hours',
      keyMetricLabel: 'Min Wall Thickness',
      keyMetricValue: '0.6 mm',
      standard: 'ISO/ASTM 52900',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: 'fdm-high-performance',
    translationId: 'fdm',
    title: 'High-Performance FDM',
    category: 'Industrial Thermoplastics',
    description: 'Industrial extrusion of aerospace-grade thermoplastics including PEEK, ULTEM™ 9085, and carbon-fiber composites for extreme operating environments.',
    materialRef: 'peek-fdm',
    techTags: ['PEEK 450G', 'ULTEM™ 9085', 'FAR 25.853 Flammability', 'Continuous Fiber'],
    specs: {
      tolerance: '± 0.15 mm',
      leadTime: '2 - 3 Days',
      keyMetricLabel: 'Max Operating Temp',
      keyMetricValue: '250 °C',
      standard: 'ASTM D638 / D648',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: 'cnc-machining-precision',
    translationId: 'cnc',
    title: 'Precision CNC Machining',
    category: 'Subtractive Manufacturing',
    description: '3-axis, 4-axis, and 5-axis CNC milling along with live-tooling turning for aerospace alloys, stainless steels, and engineered polymers.',
    materialRef: 'alu-6061-cnc',
    techTags: ['5-Axis Milling', 'CNC Turning', 'Al 6061/7075', 'SS 316L'],
    specs: {
      tolerance: '± 0.025 mm',
      leadTime: '3 - 5 Days',
      keyMetricLabel: 'Surface Roughness',
      keyMetricValue: 'Ra 0.8 - 1.6 μm',
      standard: 'DIN ISO 2768-f',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    id: 'sheet-metal-laser',
    translationId: 'sheet',
    title: 'Sheet Metal & Laser Cutting',
    category: 'Forming & Fabrication',
    description: 'Precision fiber laser cutting, CNC press brake forming, hardware insertion (PEM studs/standoffs), and robotic TIG/MIG welding.',
    materialRef: 'sheet-alu-5052',
    techTags: ['Fiber Laser', 'CNC Press Brake', 'PEM Insertion', 'Powder Coated'],
    specs: {
      tolerance: '± 0.10 mm',
      leadTime: '2 - 4 Days',
      keyMetricLabel: 'Sheet Thickness Range',
      keyMetricValue: '0.5 - 20 mm',
      standard: 'ISO 2768-m',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    id: 'digital-fabrication-tooling',
    translationId: 'tooling',
    title: 'Digital Fabrication & Rapid Tooling',
    category: 'Bridge & Volume Tooling',
    description: 'Rapid aluminum injection mold tooling and vacuum urethane casting for bridge production, pre-series qualification, and rapid scaling.',
    materialRef: 'pa12-sls',
    techTags: ['Bridge Tooling', 'Urethane Casting', '100 - 10,000 Pcs', 'Fast Mold Cycling'],
    specs: {
      tolerance: '± 0.05 mm',
      leadTime: '7 - 12 Days',
      keyMetricLabel: 'Batch Scaling',
      keyMetricValue: '100 - 50k+ pcs',
      standard: 'SPI Mold Class 104',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

const SERVICE_ACCENTS = [
  'var(--cam-blue-primary)',
  'var(--cam-cyan-tech)',
  'var(--cam-purple)',
  'var(--cam-warning)',
  'var(--cam-success)',
];

const N_CARDS = SERVICES_CATALOG.length;
const RAIL_SLOT_COUNT = N_CARDS * 2;
const RAIL_DURATION_MS = 26000;
// Fallback geometry used only before the first DOM measurement. PITCH is
// derived from the same relationship the live geometry uses (the CSS token
// --cam-svc-gap): PITCH = CARD_W + GAP, LOOP = N_CARDS * PITCH.
const RAIL_FALLBACK_CARD_W = 266.4;
const RAIL_FALLBACK_GAP = 17;
const RAIL_FALLBACK_PITCH = RAIL_FALLBACK_CARD_W + RAIL_FALLBACK_GAP;
const RAIL_FALLBACK_VIEWPORT_W = 1396;

interface RailGeometry {
  viewportW: number;
  cardW: number;
  cardH: number;
  pitch: number;
  loopWidth: number;
  isRTL: boolean;
}

function fmod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

interface ServiceCardProps {
  service: ServiceDefinition;
  index: number;
  interactive: boolean;
  active?: boolean;
  tabIndex?: number;
  onFocus?: () => void;
  onBlur?: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  index,
  interactive,
  active = false,
  tabIndex,
  onFocus,
  onBlur,
}) => {
  const { startManufacturingRequest } = useStore();
  const { t } = useTranslation();

  const cardClass = [
    active ? 'svc-active-card' : null,
    interactive ? 'card card-interactive service-card' : 'service-card',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cardClass}
      onClick={interactive ? () => startManufacturingRequest() : undefined}
      onFocus={interactive ? onFocus : undefined}
      onBlur={interactive ? onBlur : undefined}
    >
      <div
        className="service-card-image"
        aria-hidden="true"
        style={{ '--service-accent': SERVICE_ACCENTS[index % SERVICE_ACCENTS.length] } as React.CSSProperties}
      >
        <span className="service-card-image-icon">{service.iconSvg}</span>
      </div>

      <div className="service-card-body">
        <div className="service-card-header">
          <span className="service-category-badge">
            {t(`service.${service.translationId}.category`)}
          </span>
          <span className="service-index">
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        <h3 className="card-title">
          {t(`service.${service.translationId}.title`)}
        </h3>

        <p className="card-description">
          {t(`service.${service.translationId}.description`)}
        </p>

        <div className="service-tech-tags">
          {service.techTags.map((tag) => (
            <span key={tag} className="badge badge-neutral">
              {tag}
            </span>
          ))}
        </div>

        <div className="service-spec-matrix">
          <div className="spec-entry">
            <span className="spec-key">{t('service.tolerance')}</span>
            <span className="spec-val" style={{ color: 'var(--cam-cyan-tech)' }}>{service.specs.tolerance}</span>
          </div>
          <div className="spec-entry">
            <span className="spec-key">{t('service.leadTime')}</span>
            <span className="spec-val" style={{ color: 'var(--cam-success)' }}>{service.specs.leadTime}</span>
          </div>
          <div className="spec-entry">
            <span className="spec-key">{service.specs.keyMetricLabel}</span>
            <span className="spec-val">{service.specs.keyMetricValue}</span>
          </div>
          <div className="spec-entry">
            <span className="spec-key">{t('service.standard')}</span>
            <span className="spec-val">{service.specs.standard}</span>
          </div>
        </div>

        <div className="service-card-action">
          {interactive ? (
            <button
              className="btn btn-sm btn-primary"
              tabIndex={tabIndex}
              onClick={(e) => {
                e.stopPropagation();
                startManufacturingRequest();
              }}
              onFocus={onFocus}
              onBlur={onBlur}
            >
              {t('actions.configure')} {t(`service.${service.translationId}.title`)}
            </button>
          ) : (
            <span className="btn btn-sm btn-primary" aria-hidden="true">
              {t('actions.configure')} {t(`service.${service.translationId}.title`)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

function railTransform(
  k: number,
  g: RailGeometry | null,
  active: number | null,
  phase: number,
): { shift: '' | 'svc-left' | 'svc-right'; active: boolean } {
  if (active === null) return { shift: '', active: false };
  const pitch = g ? g.pitch : RAIL_FALLBACK_PITCH;
  const cardW = g ? g.cardW : RAIL_FALLBACK_CARD_W;
  const viewportW = g ? g.viewportW : RAIL_FALLBACK_VIEWPORT_W;
  const isRTL = g ? g.isRTL : false;
  const q = fmod(phase, N_CARDS * pitch);
  const xOf = (slot: number) => {
    let x = (slot - N_CARDS) * pitch + q;
    if (isRTL) x = viewportW - x - cardW;
    return x;
  };
  // Each service appears at two conveyor slots (primary + echo pass). Sides
  // are assigned in SCREEN space for the whole row against the copy nearest
  // the viewport centre, so neighbours always move away from the hovered
  // card and no mid-window convergence is possible (a per-seat "nearest
  // copy" split makes the two middle neighbours collide ~23px). The pass
  // seam (slot N-1 <-> slot N) is covered by the same anchoring.
  const a0 = isRTL ? N_CARDS - 1 - active : active;
  const a1 = a0 + N_CARDS;
  const center = viewportW / 2;
  const anchor = Math.abs(xOf(a0) - center) <= Math.abs(xOf(a1) - center) ? a0 : a1;
  if (k === a0 || k === a1) {
    // Both copies rise + scale, but only the anchored copy stays put; the far
    // copy rides the direction of its own flank (transform layers are
    // separate: shift on .svc-shift, lift on .service-card) so it never sits
    // in the path of a drifting neighbour. Without this the entering copy
    // collides ~11px with its flank for a short window every loop.
    return k === anchor
      ? { shift: '', active: true }
      : { shift: xOf(k) < xOf(anchor) ? 'svc-left' : 'svc-right', active: true };
  }
  return { shift: xOf(k) < xOf(anchor) ? 'svc-left' : 'svc-right', active: false };
}

export const ServicesSection: React.FC = () => {
  const { startManufacturingRequest } = useStore();
  const { t } = useTranslation();
  const railEnabled = useMediaQuery(
    '(pointer: fine) and (min-width: 1281px) and (not (prefers-reduced-motion: reduce))',
  );

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeIndexRef = useRef<number | null>(null);
  const hoveredRef = useRef(false);
  const phaseRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const laneRef = useRef<HTMLDivElement | null>(null);
  const seatEls = useRef<HTMLElement[]>([]);
  const geometryRef = useRef<RailGeometry | null>(null);

  const isRTL =
    typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  // Stable identity signature of the current seat structure (stable service
  // ids, echo vs first pass). Any remount changes this and re-triggers the
  // pre-paint measurement/positioning; locale re-renders flow through it too,
  // so heights re-sync whenever the translated text changes card sizes.
  const seatSignature = Array.from(
    { length: RAIL_SLOT_COUNT },
    (_, k) => {
      const isEcho = k >= N_CARDS;
      const label = isRTL ? N_CARDS - 1 - (k % N_CARDS) : k % N_CARDS;
      return `${SERVICES_CATALOG[label].id}${isEcho ? ':echo' : ':rail'}`;
    },
  ).join(',');

  const positionSeats = useCallback((g: RailGeometry) => {
    const seats = seatEls.current;
    const { viewportW, cardW, pitch, loopWidth } = g;
    // Two passes of the five services on a shared computational circle.
    // Seat k sits on slot base (k - N_CARDS) * pitch. A single continuous
    // phase (never reset, never reordered) shifts that base by q = phase
    // modulo the loop width. Positions are always EXACTLY one pitch apart:
    //   x_k = (k - N_CARDS) * pitch + q
    // The pass hand-off frame (q wrapping loopWidth -> 0) paints identical
    // pixels, so there is never a full-track jump or an empty rail.
    // The direction flag is read live: i18n switches document.documentElement.dir
    // on locale change without resizing, so a cached snapshot would leave the
    // row LTR-anchored (and misalign hover math) until the next resize.
    const isRTL = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    g.isRTL = isRTL;
    const q = fmod(phaseRef.current, loopWidth);
    for (let k = 0; k < seats.length; k++) {
      const el = seats[k];
      if (!el) continue;
      let x = (k - N_CARDS) * pitch + q;
      if (isRTL) x = viewportW - x - cardW;
      el.style.transform = `translate3d(${x}px, 0, 0)`;
    }
  }, []);

  const measureRail = useCallback(() => {
    const viewport = viewportRef.current;
    const lane = laneRef.current;
    if (!viewport || !lane) return;
    const seats = Array.from(lane.querySelectorAll<HTMLElement>('.svc-seat'));
    seatEls.current = seats;
    const first = seats[0];
    const cardW = first ? first.getBoundingClientRect().width : RAIL_FALLBACK_CARD_W;
    // Unify the row height: every seat gets the tallest card height so all
    // five cards share one outer height (tops are already aligned at top:0).
    // Measure each seat while still untransformed (content height) and take
    // the max with a small ceil slack so no card clips at its bottom edge.
    let cardH = 0;
    for (const s of seats) {
      if (!s) continue;
      const h = s.getBoundingClientRect().height;
      if (h > cardH) cardH = h;
    }
    cardH = cardH > 0 ? Math.ceil(cardH) + 2 : 0;
    const gapEl = viewport.children[0] || viewport;
    let gapTxt = getComputedStyle(gapEl).getPropertyValue('--cam-svc-gap').trim();
    const gapRef = gapTxt.match(/--[\w-]+/);
    if (gapRef) {
      const refVal = getComputedStyle(gapEl).getPropertyValue(gapRef[0]).trim();
      if (refVal) gapTxt = refVal;
    }
    const gap = Number.parseFloat(gapTxt) || RAIL_FALLBACK_GAP;
    const pitch = cardW + gap;
    geometryRef.current = {
      viewportW: viewport.clientWidth,
      cardW,
      cardH,
      pitch,
      loopWidth: N_CARDS * pitch,
      isRTL: document.documentElement.dir === 'rtl',
    };
    if (cardH > 0) {
      lane.style.height = `${cardH}px`;
      viewport.style.setProperty('--cam-svc-card-h', `${cardH}px`);
    }
    if (geometryRef.current) positionSeats(geometryRef.current);
  }, [positionSeats]);

  useLayoutEffect(() => {
    if (!railEnabled) return;
    // Runs before paint whenever the rail (or any of its seats) mounts or the
    // seat signature changes, so seats are never visible stacked at left:0.
    // The seat signature is derived from stable service ids, so locale/RTL
    // re-renders (same keys, no remount) do not thrash the DOM.
    measureRail();
    window.addEventListener('resize', measureRail);
    return () => window.removeEventListener('resize', measureRail);
  }, [railEnabled, measureRail, seatSignature]);

  useEffect(() => {
    if (!railEnabled) return;
    // i18n flips document.documentElement dir/lang on locale change without a
    // resize: re-measure (the two passes may carry different card heights) and
    // reposition immediately. Attribute changes are rare, so one layout read
    // per change is fine — nothing is measured per animation frame.
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => measureRail());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir', 'lang'],
    });
    return () => observer.disconnect();
  }, [railEnabled, measureRail]);

  useEffect(() => {
    if (!railEnabled) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const g = geometryRef.current;
      const period = g ? g.loopWidth : N_CARDS * RAIL_FALLBACK_PITCH;
      if (!hoveredRef.current && activeIndexRef.current === null) {
        // phase grows without bound; positionSeats wraps it continuously,
        // so there is never a full-track reset.
        phaseRef.current += (period / RAIL_DURATION_MS) * dt;
      }
      if (g) positionSeats(g);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [railEnabled, positionSeats]);

  const handlePointerEnter = useCallback(() => {
    hoveredRef.current = true;
  }, []);

  const handlePointerLeave = useCallback(() => {
    hoveredRef.current = false;
    activeIndexRef.current = null;
    setActiveIndex(null);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const g = geometryRef.current;
    if (!viewport || !g) return;
    const rect = viewport.getBoundingClientRect();
    const isRTL = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    let cc = e.clientX - rect.left;
    if (isRTL) cc = g.viewportW - cc;
    // Inverse of x = (k - N_CARDS) * pitch + q modulo a loop of five.
    const q = fmod(phaseRef.current, g.loopWidth);
    const slot = ((Math.floor((cc - q) / g.pitch) % N_CARDS) + N_CARDS) % N_CARDS;
    const label = isRTL ? N_CARDS - 1 - slot : slot;
    if (label !== activeIndexRef.current) {
      activeIndexRef.current = label;
      setActiveIndex(label);
    }
  }, []);

  const focusCard = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  const handleCardBlur = useCallback(() => {
    if (laneRef.current && laneRef.current.contains(document.activeElement)) return;
    activeIndexRef.current = null;
    setActiveIndex(null);
  }, []);

  const handleScrollerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('.service-card')) return;
      if (target.closest('button, a')) return;
      startManufacturingRequest();
    },
    [startManufacturingRequest],
  );

  return (
    <SectionReveal
      className="section-padding services-section"
      id="services-section"
    >
      <div className="container">
        <div className="section-header">
          <div className="section-badge">
            <span className="section-badge-dot"></span>
            <span>{t('sections.capabilities')}</span>
          </div>
          <h2 className="section-title">{t('sections.servicesTitle')}</h2>
          <p className="section-subtitle">
            {t('sections.servicesDescription')}
          </p>
        </div>

        {railEnabled ? (
          <ScrollReveal
            className="services-scroller services-scroller--conveyor"
            onPointerEnter={handlePointerEnter}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onClick={handleScrollerClick}
          >
            <div className="services-viewport" ref={viewportRef}>
              <div className="services-lane" ref={laneRef}>
                {Array.from({ length: RAIL_SLOT_COUNT }).map((_, k) => {
                  const isEcho = k >= N_CARDS;
                  const label = isRTL ? N_CARDS - 1 - (k % N_CARDS) : k % N_CARDS;
                  const service = SERVICES_CATALOG[label];
                  const { shift, active: isActive } = railTransform(
                    k,
                    geometryRef.current,
                    activeIndex,
                    phaseRef.current,
                  );
                  return (
                    <div
                      key={`${service.id}-${isEcho ? 'echo' : 'rail'}`}
                      className={[
                        'svc-seat',
                        isActive ? 'svc-active-seat' : null,
                        isEcho ? 'svc-seat--echo' : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-hidden={isEcho || undefined}
                    >
                      <div className={`svc-shift ${shift}`.trim()}>
                        <ServiceCard
                          service={service}
                          index={label}
                          interactive
                          active={isActive}
                          tabIndex={isEcho ? -1 : undefined}
                          onFocus={() => focusCard(label)}
                          onBlur={handleCardBlur}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        ) : (
          <StaggerReveal className="services-grid">
            {SERVICES_CATALOG.map((service, index) => (
              <ServiceCard key={service.id} service={service} index={index} interactive />
            ))}
          </StaggerReveal>
        )}
      </div>
    </SectionReveal>
  );
};
