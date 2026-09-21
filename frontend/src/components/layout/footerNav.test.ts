import { describe, expect, it } from 'vitest';
import { FOOTER_COLUMNS, FOOTER_LEGAL, FOOTER_SOCIAL } from './footerNav';
import type { ViewType } from '../../types';

/** Views the footer is allowed to target. Admin views are excluded on
 *  purpose — the footer never links into the admin console directly. */
const KNOWN_VIEWS: ReadonlySet<string> = new Set<string>([
  'home',
  'services',
  'materials',
  'workflow',
  'about',
  'dashboard',
  'profile',
  'marketplace',
  'manufacturing-request',
  'submit-quote',
  'quote-success',
  'quotes',
  'shipping',
  'contact',
  'faq',
  'privacy',
  'terms',
  'nda',
  'security',
  'coming-soon',
]);

/** Section anchors the footer may scroll to. Service card anchors are
 *  generated as `service-<catalog id>` in ServicesSection. */
const KNOWN_SECTIONS: ReadonlySet<string> = new Set<string>([
  'services-section',
  'service-3d-printing-industrial',
  'service-fdm-high-performance',
  'service-cnc-machining-precision',
  'service-sheet-metal-laser',
  'service-digital-fabrication-tooling',
  'materials-section',
  'about',
]);

describe('footer navigation model', () => {
  it('has exactly three link columns in the approved order', () => {
    expect(FOOTER_COLUMNS.map((c) => c.headingKey)).toEqual([
      'footer2.manufacturing',
      'footer2.platform',
      'footer2.company',
    ]);
  });

  it('every row resolves to a known view / real filter preset / real flow', () => {
    const labels = new Set<string>();
    for (const col of FOOTER_COLUMNS) {
      for (const row of col.rows) {
        // No duplicate labels anywhere in the footer.
        expect(labels.has(row.labelKey), `duplicate footer label ${row.labelKey}`).toBe(false);
        labels.add(row.labelKey);
        const target = row.target;
        if (target.kind === 'view') {
          expect(KNOWN_VIEWS.has(target.view), `${row.labelKey} -> unknown view ${target.view}`).toBe(true);
          if (target.sectionId) {
            expect(KNOWN_SECTIONS.has(target.sectionId), `${row.labelKey} -> unknown section ${target.sectionId}`).toBe(true);
          }
        } else if (target.kind === 'materials') {
          // Preset values must match the real explorer chip values.
          if (target.preset.tech !== undefined) {
            expect(['ALL', 'SLS', 'SLA', 'FDM', 'CNC', 'DMLS', 'Sheet Metal']).toContain(target.preset.tech);
          }
          if (target.preset.category !== undefined) {
            expect(['ALL', 'Polymers', 'High-Performance', 'Metals', 'Resins', 'Elastomers']).toContain(target.preset.category);
          }
        } else if (target.kind === 'customer') {
          expect(['dashboard', 'quotes']).toContain(target.view);
        } else {
          // submitQuote is the only remaining kind — the existing flow.
          expect(target.kind).toBe('submitQuote');
        }
      }
    }
  });

  it('manufacturing and platform columns have the approved row counts', () => {
    expect(FOOTER_COLUMNS[0].rows).toHaveLength(6);
    expect(FOOTER_COLUMNS[1].rows).toHaveLength(6);
    expect(FOOTER_COLUMNS[2].rows).toHaveLength(7);
  });

  it('bottom legal bar duplicates the real company-column legal views', () => {
    const views = FOOTER_LEGAL.map((e) => e.view) as ViewType[];
    expect(views).toEqual(['privacy', 'terms', 'nda', 'security']);
  });

  it('social entries carry no hrefs (no official URLs configured)', () => {
    expect(FOOTER_SOCIAL).toHaveLength(3);
    for (const s of FOOTER_SOCIAL) {
      expect(s).not.toHaveProperty('href');
      expect(s).not.toHaveProperty('url');
    }
  });
});
