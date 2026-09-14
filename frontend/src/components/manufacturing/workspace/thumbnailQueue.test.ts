import { describe, it, expect } from 'vitest';
import { UploadItem } from './types';
import { CadFile } from '../../../types';
import { activeThumbIdsFor, MAX_CONCURRENT_THUMBNAILS, pendingThumbIds, thumbnailMatches } from './thumbnailQueue';

const readyCadFile = (id: string): CadFile => ({
  id,
  latestVersion: {
    processingStatus: 'COMPLETE',
    metadata: {
      geometryStatus: 'READY',
      supportLevel: 'SUPPORTED',
      volume: 1,
      surfaceArea: 1,
      dimensions: { width: 1, height: 1, depth: 1 },
    },
  },
} as unknown as CadFile);

const makeItem = (id: string, format: string, overrides?: Partial<UploadItem>): UploadItem => ({
  id,
  name: `${id}.${format.toLowerCase()}`,
  format,
  sizeBytes: 1,
  size: '1 B',
  status: 'ready',
  validationState: 'valid',
  processingComplete: true,
  progress: 100,
  cadFile: readyCadFile(id),
  ...overrides,
});

describe('thumbnailMatches', () => {
  it('accepts formats that render real geometry', () => {
    expect(thumbnailMatches(makeItem('a', 'STL'))).toBe(true);
    expect(thumbnailMatches(makeItem('b', 'step'))).toBe(true);
    expect(thumbnailMatches(makeItem('c', 'IGES'))).toBe(true);
    expect(thumbnailMatches(makeItem('d', 'dxf'))).toBe(true);
  });
  it('rejects document formats that fall back to the file icon', () => {
    expect(thumbnailMatches(makeItem('e', 'SVG'))).toBe(false);
    expect(thumbnailMatches(makeItem('f', 'PDF'))).toBe(false);
  });
  it('is case insensitive for format', () => {
    expect(thumbnailMatches(makeItem('g', 'obj'))).toBe(true);
  });
  it('rejects items that are not fully ready', () => {
    expect(thumbnailMatches(makeItem('h', 'STL', { status: 'processing' }))).toBe(false);
    expect(thumbnailMatches(makeItem('i', 'STL', { processingComplete: false }))).toBe(false);
  });
  it('renders a thumbnail for an analysed 2D drawing with no volume', () => {
    const drawing = makeItem('k', 'DXF');
    (drawing.cadFile!.latestVersion as { metadata?: object }).metadata = {
      geometryStatus: 'READY',
      supportLevel: 'SUPPORTED',
    };
    expect(thumbnailMatches(drawing)).toBe(true);
  });
  it('rejects items without a cad file', () => {
    expect(thumbnailMatches(makeItem('j', 'STL', { cadFile: undefined }))).toBe(false);
  });
});

describe('pendingThumbIds', () => {
  const items = [makeItem('1', 'STL'), makeItem('2', 'STEP'), makeItem('3', 'PDF'), makeItem('4', 'OBJ')];
  it('returns capturable ids without a thumbnail, in upload order', () => {
    expect(pendingThumbIds(items, {}, {})).toEqual(['1', '2', '4']);
  });
  it('skips files that already have a thumbnail so work is never repeated', () => {
    expect(pendingThumbIds(items, { '2': 'data:image/png;base64,x' }, {})).toEqual(['1', '4']);
  });
  it('skips failed generations', () => {
    expect(pendingThumbIds(items, {}, { '1': true })).toEqual(['2', '4']);
  });
  it('returns an empty list when nothing needs a thumbnail', () => {
    expect(pendingThumbIds([], {}, {})).toEqual([]);
  });
});

describe('activeThumbIdsFor', () => {
  it(`never renders more than ${MAX_CONCURRENT_THUMBNAILS} thumbnails at once`, () => {
    expect(activeThumbIdsFor(['1', '2', '3', '4'])).toHaveLength(MAX_CONCURRENT_THUMBNAILS);
    expect(activeThumbIdsFor(['1', '2', '3', '4'])).toEqual(['1', '2']);
  });
  it('renders fewer when the queue is small', () => {
    expect(activeThumbIdsFor(['1'])).toEqual(['1']);
    expect(activeThumbIdsFor([])).toEqual([]);
  });
  it('advances the window as completed files drop off the queue', () => {
    expect(activeThumbIdsFor(pendingThumbIds([makeItem('1', 'STL'), makeItem('2', 'STEP'), makeItem('3', 'PLY')], { '1': 'data:image/png;base64,x' }, {}))).toEqual(['2', '3']);
  });
});