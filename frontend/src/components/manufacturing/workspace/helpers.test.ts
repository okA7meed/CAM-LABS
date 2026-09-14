import { describe, it, expect } from 'vitest';
import { formatBytes, hasOwn, isMultiFileQuote, normalizeInfillInput, fdmParametersFor, panelStatusClass, canSubmitFinal, parseFormattedPrice, formatEgp, priceWithPriority } from './helpers';
import { CalculatedQuotationData, MultiFileQuotation } from '../../../services/api';

const makeCalculated = (overrides?: Partial<CalculatedQuotationData>): CalculatedQuotationData =>
  ({ formattedTotalPrice: '150.00 EGP', leadTime: '5 days', ...overrides }) as CalculatedQuotationData;

describe('formatBytes', () => {
  it('returns empty string for 0 or undefined', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(undefined)).toBe('');
  });
  it('formats bytes as B for < 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B');
  });
  it('formats KB without decimals', () => {
    expect(formatBytes(2048)).toBe('2 KB');
  });
  it('formats MB with two decimals', () => {
    expect(formatBytes(1048576)).toBe('1.00 MB');
  });
});

describe('hasOwn', () => {
  it('returns true for own properties', () => {
    expect(hasOwn({ a: 1 }, 'a')).toBe(true);
  });
  it('returns false for inherited or missing properties', () => {
    expect(hasOwn({ a: 1 }, 'b')).toBe(false);
    expect(hasOwn({}, 'toString')).toBe(false);
  });
});

describe('isMultiFileQuote', () => {
  it('returns true when the quote has a files property', () => {
    const multi = { files: [], formattedTotalPrice: '100' } as unknown as MultiFileQuotation;
    expect(isMultiFileQuote(multi)).toBe(true);
  });
  it('returns false for a CalculatedQuotationData', () => {
    expect(isMultiFileQuote(makeCalculated())).toBe(false);
  });
  it('returns false for null', () => {
    expect(isMultiFileQuote(null)).toBe(false);
  });
});

describe('normalizeInfillInput', () => {
  it('rounds to the nearest integer', () => {
    expect(normalizeInfillInput('14.7')).toBe(15);
  });
  it('clamps to [0, 100]', () => {
    expect(normalizeInfillInput('120')).toBe(100);
    expect(normalizeInfillInput('-5')).toBe(0);
  });
  it('returns null for non-numeric input', () => {
    expect(normalizeInfillInput('abc')).toBeNull();
    expect(normalizeInfillInput('---')).toBeNull();
  });
  it('coerces an empty string to 0 (Number("") semantics)', () => {
    expect(normalizeInfillInput('')).toBe(0);
  });
  it('trims whitespace before parsing', () => {
    expect(normalizeInfillInput(' 30 ')).toBe(30);
  });
});

describe('fdmParametersFor', () => {
  it('returns preset values when using a standard quality id', () => {
    const p = fdmParametersFor('standard', 3);
    expect(p.infillPercent).toBe(15);
    expect(p.wallCount).toBe(3);
    expect(p.layerHeightMm).toBe(0.2);
    expect(p.supportEnabled).toBe(false);
  });
  it('falls back to standard if the quality id is unknown', () => {
    const p = fdmParametersFor('unknown', 2);
    expect(p.infillPercent).toBe(15);
  });
  it('uses the custom infill when provided and valid', () => {
    const p = fdmParametersFor('standard', 3, false, 50);
    expect(p.infillPercent).toBe(50);
  });
  it('ignores non-integer custom infill and uses the preset value', () => {
    const p = fdmParametersFor('standard', 3, false, 33.3);
    expect(p.infillPercent).toBe(15);
  });
  it('respects supportEnabled flag', () => {
    const p = fdmParametersFor('standard', 3, true);
    expect(p.supportEnabled).toBe(true);
  });
});

describe('panelStatusClass', () => {
  it('returns inactive when upstream is not ready', () => {
    expect(panelStatusClass(false, false)).toBe('inactive');
    expect(panelStatusClass(true, false)).toBe('inactive');
  });
  it('returns completed when done is true and upstream is ready', () => {
    expect(panelStatusClass(true, true)).toBe('completed');
  });
  it('returns active when done is false but upstream is ready', () => {
    expect(panelStatusClass(false, true)).toBe('active');
  });
});

describe('canSubmitFinal', () => {
  const readyCadFile = { id: 'cf-1', latestVersion: { processingStatus: 'COMPLETE', metadata: { geometryStatus: 'READY', volume: 10, surfaceArea: 60, dimensions: { width: 1, height: 1, depth: 1 } } } } as any;
  const readyUpload = { status: 'ready' as const, validationState: 'valid' as const, processingComplete: true, cadFile: readyCadFile } as any;
  const req = { cadFile: { id: 'cf-1' } as any, process: 'fdm', material: 'pla', quantity: 1 } as any;
  it('returns true when all conditions are satisfied', () => {
    expect(canSubmitFinal(makeCalculated(), false, false, req, [readyUpload])).toBe(true);
  });
  it('returns false when quote is null', () => {
    expect(canSubmitFinal(null, false, false, req, [readyUpload])).toBe(false);
  });
  it('returns false when still calculating', () => {
    expect(canSubmitFinal(makeCalculated(), true, false, req, [readyUpload])).toBe(false);
  });
  it('returns false when quote failed', () => {
    expect(canSubmitFinal(makeCalculated(), false, true, req, [readyUpload])).toBe(false);
  });
  it('returns false when request is missing cadFile', () => {
    expect(canSubmitFinal(makeCalculated(), false, false, { ...req, cadFile: null }, [readyUpload])).toBe(false);
  });
  it('returns false when not all uploads are ready', () => {
    expect(canSubmitFinal(makeCalculated(), false, false, req, [readyUpload, { status: 'uploading' }])).toBe(false);
  });
});

describe('parseFormattedPrice', () => {
  it('parses a standard formatted EGP amount', () => {
    expect(parseFormattedPrice('2,484.18 EGP')).toBe(2484.18);
  });
  it('parses integer amounts without decimals or currency', () => {
    expect(parseFormattedPrice('1,480')).toBe(1480);
  });
  it('handles negative values', () => {
    expect(parseFormattedPrice('-250.00 EGP')).toBe(-250);
  });
  it('returns 0 for empty or garbage input', () => {
    expect(parseFormattedPrice('')).toBe(0);
    expect(parseFormattedPrice(null)).toBe(0);
    expect(parseFormattedPrice(undefined)).toBe(0);
    expect(parseFormattedPrice('Pending')).toBe(0);
  });
});

describe('formatEgp', () => {
  it('formats with exactly two decimals and the EGP suffix', () => {
    expect(formatEgp(2484.18)).toBe('2,484.18 EGP');
    expect(formatEgp(100)).toBe('100.00 EGP');
    expect(formatEgp(2484.1)).toBe('2,484.10 EGP');
  });
});

describe('priceWithPriority', () => {
  it('returns the quote base verbatim when priority shipping is off', () => {
    expect(priceWithPriority('2,484.18 EGP', false)).toBe('2,484.18 EGP');
  });
  it('adds the fixed 100 EGP surcharge when priority shipping is on', () => {
    expect(priceWithPriority('2,484.18 EGP', true)).toBe('2,584.18 EGP');
    expect(priceWithPriority('1,480.00 EGP', true)).toBe('1,580.00 EGP');
  });
  it('never mutates the derived total when re-applied: derivation is a pure function of the quote base', () => {
    // The fee is a single surcharge over the quote base; the derived value is
    // never fed back in (toggle state is the only input besides the base).
    expect(parseFormattedPrice(priceWithPriority('2,484.18 EGP', false)) + 100).toBe(parseFormattedPrice(priceWithPriority('2,484.18 EGP', true)));
  });
});