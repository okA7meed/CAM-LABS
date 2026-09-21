import { describe, expect, it } from 'vitest';
import { CadFile, Quote } from '../../types';
import {
  fileLineTotal,
  findSpecParam,
  formatLiveDims,
  joinFullAddress,
  quoteTimelineOf,
  resolveWorkspaceFiles,
  selectedFileSpecs,
} from './quoteWorkspaceUtils';

const cad = (id: string, name: string, extra: Partial<CadFile> = {}): CadFile =>
  ({ id, name, format: 'STL', size: '1.00 MB', dimensions: '10.000 × 10.000 × 10.000 units', ...extra }) as CadFile;

const quote = (extra: Partial<Quote> = {}): Quote =>
  ({
    id: 'RFQ-1',
    reference: 'CAM-2026-000001',
    partName: 'Bracket',
    technology: 'FDM',
    material: 'abs',
    quantity: 2,
    leadTime: '24 - 48 Hours',
    unitPrice: '100.00 EGP',
    totalPrice: '200.00 EGP',
    validUntil: '2026-10-05T00:00:00.000Z',
    status: 'Ready for Approval',
    createdAt: '2026-09-19T10:24:00.000Z',
    ...extra,
  }) as Quote;

describe('resolveWorkspaceFiles', () => {
  it('keeps authoritative cadFileIds order and joins catalog + pricing', () => {
    const q = quote({
      cadFileIds: ['b', 'a'],
      pricingBreakdown: {
        files: [
          { fileId: 'a', fileName: 'A.stl', quantity: 1, material: 'abs', process: 'FDM', perUnitCost: 10, pricingBreakdown: {} },
          { fileId: 'b', fileName: 'B.stl', quantity: 3, material: 'abs', process: 'FDM', perUnitCost: 20, pricingBreakdown: {} },
        ],
      },
    });
    const byId = new Map([['a', cad('a', 'A.stl')], ['b', cad('b', 'B.stl')]]);
    const files = resolveWorkspaceFiles(q, byId);
    expect(files.map((f) => f.fileId)).toEqual(['b', 'a']);
    expect(files[0].vm?.quantity).toBe(3);
    expect(files[0].name).toBe('B.stl');
  });

  it('marks unresolvable files without inventing them', () => {
    const q = quote({ cadFileIds: ['missing'] });
    const files = resolveWorkspaceFiles(q, new Map());
    expect(files).toHaveLength(1);
    expect(files[0].cad).toBeNull();
    expect(files[0].vm).toBeNull();
    expect(files[0].name).toBe('missing');
  });

  it('returns no files when the quote carries no ids', () => {
    expect(resolveWorkspaceFiles(quote(), new Map())).toEqual([]);
  });
});

describe('selectedFileSpecs', () => {
  it('derives per-file specs from real pricing + catalog, never fabricating', () => {
    const q = quote({
      cadFileIds: ['a'],
      toleranceGrade: 'standard',
      surfaceFinish: 'Standard',
      pricingBreakdown: {
        files: [{ fileId: 'a', fileName: 'A.stl', quantity: 2, material: 'tpu', process: 'FDM', perUnitCost: 50, pricingBreakdown: {} }],
      },
    });
    const [file] = resolveWorkspaceFiles(q, new Map([['a', cad('a', 'A.stl')]]));
    const specs = selectedFileSpecs(file, q, null);
    const byKey = Object.fromEntries(specs.map((s) => [s.key, s.value]));
    expect(byKey.material).toBe('tpu');
    expect(byKey.technology).toBe('FDM');
    expect(byKey.quantity).toBe('2 pcs');
    expect(byKey.dimensions).toBe('10.000 × 10.000 × 10.000 units');
    expect(byKey.tolerance).toBe('Standard');
    expect(byKey.finish).toBe('Standard');
    expect(byKey.unit).toBe('50.00 EGP');
    // Engine-input params are absent from storage → omitted, not faked.
    expect(byKey.layer).toBeUndefined();
    expect(byKey.infill).toBeUndefined();
    expect(byKey.color).toBeUndefined();
  });

  it('prefers live geometry dimensions when available', () => {
    const q = quote({ cadFileIds: ['a'] });
    const [file] = resolveWorkspaceFiles(q, new Map([['a', cad('a', 'A.stl')]]));
    const specs = selectedFileSpecs(file, q, { width: 96.8, height: 71.2, depth: 38.5 });
    expect(specs.find((s) => s.key === 'dimensions')?.value).toBe('96.80 × 71.20 × 38.50 mm');
  });
});

describe('fileLineTotal', () => {
  it('multiplies real per-unit cost by real quantity only', () => {
    expect(fileLineTotal({ perUnitCost: 50, quantity: 2 } as never)).toBe('100.00 EGP');
    expect(fileLineTotal({ perUnitCost: null, quantity: 2 } as never)).toBeNull();
    expect(fileLineTotal(null)).toBeNull();
  });
});

describe('formatLiveDims', () => {
  it('formats X × Y × Z with units, null on bad input', () => {
    expect(formatLiveDims({ width: 96.8, height: 71.2, depth: 38.5 })).toBe('96.80 × 71.20 × 38.50 mm');
    expect(formatLiveDims(null)).toBeNull();
    expect(formatLiveDims({ width: NaN, height: 1, depth: 1 })).toBeNull();
  });
});

describe('findSpecParam', () => {
  it('finds nested engine params without throwing on cycles', () => {
    const nested: Record<string, unknown> = { a: { b: { layerHeightMm: 0.2 } } };
    expect(findSpecParam(nested, ['layerHeight', 'layerHeightMm'])).toBe('0.2');
    expect(findSpecParam({ x: 1 }, ['color'])).toBeNull();
    expect(findSpecParam(null, ['color'])).toBeNull();
  });
});

describe('quoteTimelineOf', () => {
  it('never invents intermediate timestamps', () => {
    const nodes = quoteTimelineOf(quote({ status: 'Ready for Approval' }));
    expect(nodes[0]).toMatchObject({ key: 'submitted', state: 'done', at: '2026-09-19T10:24:00.000Z' });
    expect(nodes.filter((n) => n.at !== null)).toHaveLength(2);
    expect(nodes.at(-1)?.state).toBe('pending');
  });

  it('marks approved from real audit fields and converted orders', () => {
    const nodes = quoteTimelineOf(
      quote({ status: 'Approved', statusUpdatedAt: '2026-09-21T11:45:00.000Z', convertedOrderId: 'CAM-1' }),
    );
    const approved = nodes.find((n) => n.key === 'approved');
    expect(approved).toMatchObject({ state: 'done', at: '2026-09-21T11:45:00.000Z' });
    expect(nodes.some((n) => n.key === 'converted')).toBe(true);
  });

  it('marks rejection in red with its real timestamp', () => {
    const nodes = quoteTimelineOf(quote({ status: 'Rejected', statusUpdatedAt: '2026-09-22T00:00:00.000Z' }));
    expect(nodes.find((n) => n.key === 'rejected')).toMatchObject({ state: 'error', at: '2026-09-22T00:00:00.000Z' });
  });
});

describe('joinFullAddress', () => {
  it('joins snapshot parts, null when absent', () => {
    const q = quote({ addressLine1: '12 St', city: 'Al Qasr', governorate: 'New Valley', country: 'Egypt' });
    expect(joinFullAddress(q)).toBe('12 St, Al Qasr, New Valley, Egypt');
    expect(joinFullAddress(quote())).toBeNull();
  });
});
