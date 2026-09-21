import type { ViewType } from '../../types';
import type { IconName } from '../ui/Icon';

/**
 * Single source of truth for every footer destination.
 * Each visible footer row MUST have an entry here that resolves to real
 * application content. Placeholder kinds (`#home`, `#`, coming-soon) are
 * intentionally unrepresentable.
 */
export type FooterTarget =
  /** Navigate to a real view, optionally scrolling to a real DOM section. */
  | { kind: 'view'; view: ViewType; sectionId?: string }
  /** Open the materials catalog with a real explorer filter preset applied. */
  | { kind: 'materials'; preset: { tech?: string; category?: string; search?: string } }
  /** Enter the existing manufacturing request flow (Quote ONLY, auth-gated). */
  | { kind: 'submitQuote' }
  /** Authenticated users go to the view; guests get the real auth modal with resume. */
  | { kind: 'customer'; view: 'dashboard' | 'quotes' };

export interface FooterRow {
  /** i18n label key. */
  labelKey: string;
  icon: IconName;
  target: FooterTarget;
}

export interface FooterColumn {
  /** i18n heading key. */
  headingKey: string;
  /** i18n subtitle key. */
  subtitleKey: string;
  headingIcon: IconName;
  rows: FooterRow[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    headingKey: 'footer2.manufacturing',
    subtitleKey: 'footer2.manufacturingSub',
    headingIcon: 'gear',
    rows: [
      { labelKey: 'footer2.printing3d', icon: 'cube', target: { kind: 'view', view: 'services', sectionId: 'services-section' } },
      { labelKey: 'footer2.cnc', icon: 'precision', target: { kind: 'view', view: 'services', sectionId: 'service-cnc-machining-precision' } },
      { labelKey: 'footer2.sheet', icon: 'layers3', target: { kind: 'view', view: 'services', sectionId: 'service-sheet-metal-laser' } },
      { labelKey: 'footer2.injection', icon: 'factory', target: { kind: 'view', view: 'services', sectionId: 'service-digital-fabrication-tooling' } },
      { labelKey: 'footer2.materials', icon: 'database', target: { kind: 'materials', preset: {} } },
      { labelKey: 'footer2.finishing', icon: 'surface', target: { kind: 'view', view: 'services', sectionId: 'services-section' } },
    ],
  },
  {
    headingKey: 'footer2.platform',
    subtitleKey: 'footer2.platformSub',
    headingIcon: 'layers',
    rows: [
      { labelKey: 'footer2.submitQuote', icon: 'plusCircle', target: { kind: 'submitQuote' } },
      { labelKey: 'footer2.myQuotes', icon: 'file', target: { kind: 'customer', view: 'quotes' } },
      { labelKey: 'footer2.myOrders', icon: 'package', target: { kind: 'customer', view: 'dashboard' } },
      { labelKey: 'footer2.dashboard', icon: 'userRound', target: { kind: 'customer', view: 'dashboard' } },
      { labelKey: 'footer2.shipping', icon: 'truck', target: { kind: 'view', view: 'shipping' } },
      { labelKey: 'footer2.support', icon: 'info', target: { kind: 'view', view: 'contact' } },
    ],
  },
  {
    headingKey: 'footer2.company',
    subtitleKey: 'footer2.companySub',
    headingIcon: 'users',
    rows: [
      { labelKey: 'footer2.about', icon: 'building', target: { kind: 'view', view: 'about', sectionId: 'about' } },
      { labelKey: 'footer2.contact', icon: 'mail', target: { kind: 'view', view: 'contact' } },
      { labelKey: 'footer2.faq', icon: 'clipboard', target: { kind: 'view', view: 'faq' } },
      { labelKey: 'footer.privacy', icon: 'shieldCheck', target: { kind: 'view', view: 'privacy' } },
      { labelKey: 'footer.terms', icon: 'fileClock', target: { kind: 'view', view: 'terms' } },
      { labelKey: 'footer.nda', icon: 'lock', target: { kind: 'view', view: 'nda' } },
      { labelKey: 'footer.security', icon: 'eye', target: { kind: 'view', view: 'security' } },
    ],
  },
];

/** Bottom legal bar — same real destinations as the Company column. */
export const FOOTER_LEGAL: Array<{ labelKey: string; view: ViewType }> = [
  { labelKey: 'footer.privacy', view: 'privacy' },
  { labelKey: 'footer.terms', view: 'terms' },
  { labelKey: 'footer.nda', view: 'nda' },
  { labelKey: 'footer.security', view: 'security' },
];

/** Social buttons. No official URLs are configured anywhere in the
 *  application, so these render as honest non-links (never `#`, never home). */
export const FOOTER_SOCIAL: Array<{ key: string; labelKey: string; icon: IconName }> = [
  { key: 'linkedin', labelKey: 'footer2.linkedin', icon: 'linkedin' },
  { key: 'youtube', labelKey: 'footer2.youtube', icon: 'youtube' },
  { key: 'instagram', labelKey: 'footer2.instagram', icon: 'instagram' },
];
