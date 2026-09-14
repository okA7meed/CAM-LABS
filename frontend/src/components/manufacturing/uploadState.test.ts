import { describe, it, expect } from 'vitest';
import { CadFile } from '../../types';
import {
  hasViewerGeometry,
  isCadFileReady,
  isUploadItemReady,
  isUploadItemThumbnailReady,
  areAllUploadsReady,
  hasUploadInFlight,
  hasBlockingUploadState,
} from './uploadState';

type TestMetadata = {
  geometryStatus?: string;
  viewerAsset?: { available?: boolean; format?: string } | null;
  supportLevel?: string;
  volume?: number;
  surfaceArea?: number;
  dimensions?: { width?: number; height?: number; depth?: number };
};

const readyCadFile = (overrides?: Partial<Pick<NonNullable<CadFile['latestVersion']>, 'processingStatus'>> & { metadata?: TestMetadata }): CadFile =>
  ({
    id: 'cf-1', name: 'test.stl', format: 'STL', size: '1 MB', uploaded: '2025-01-01',
    volume: '100 cm³', dimensions: '10x10x10 mm', meshTriangles: '1000', status: 'Verified CAD',
    latestVersion: {
      id: 'v1', version: 1, scanStatus: 'CLEAN', processingStatus: 'COMPLETE',
      metadata: { geometryStatus: 'READY', viewerAsset: { available: true, format: 'glb' },
        volume: 100, surfaceArea: 600, dimensions: { width: 10, height: 10, depth: 10 } },
      ...overrides,
    },
  } as unknown as CadFile);

describe('isCadFileReady', () => {
  it('returns true for a fully processed, healthy CadFile', () => {
    expect(isCadFileReady(readyCadFile())).toBe(true);
  });
  it('returns false when processing is not COMPLETE', () => {
    expect(isCadFileReady(readyCadFile({ processingStatus: 'PENDING' }))).toBe(false);
  });
  it('returns false when geometryStatus is not READY', () => {
    expect(isCadFileReady(readyCadFile({
      metadata: { geometryStatus: 'PENDING', viewerAsset: null,
        volume: 100, surfaceArea: 600, dimensions: { width: 10, height: 10, depth: 10 } },
    }))).toBe(false);
  });
  it('returns false when volume is missing or zero', () => {
    expect(isCadFileReady(readyCadFile({
      metadata: { geometryStatus: 'READY', viewerAsset: null, volume: 0, surfaceArea: 600,
        dimensions: { width: 10, height: 10, depth: 10 } },
    }))).toBe(false);
  });
  it('returns false when dimensions are missing', () => {
    expect(isCadFileReady(readyCadFile({
      metadata: { geometryStatus: 'READY', viewerAsset: null, volume: 100, surfaceArea: 600 },
    }))).toBe(false);
  });
  it('returns false when supportLevel is FAILED_VALIDATION', () => {
    expect(isCadFileReady(readyCadFile({
      metadata: { geometryStatus: 'READY', viewerAsset: null, supportLevel: 'FAILED_VALIDATION',
        volume: 100, surfaceArea: 600, dimensions: { width: 10, height: 10, depth: 10 } },
    }))).toBe(false);
  });
  it('returns false for undefined input', () => {
    expect(isCadFileReady(undefined)).toBe(false);
  });
});

describe('isUploadItemReady', () => {
  it('returns true for a ready item with a valid, processed cadFile', () => {
    expect(isUploadItemReady({
      status: 'ready', validationState: 'valid', processingComplete: true, cadFile: readyCadFile(),
    })).toBe(true);
  });
  it('returns true for a duplicate item that is otherwise ready', () => {
    expect(isUploadItemReady({
      status: 'duplicate', validationState: 'valid', processingComplete: true, cadFile: readyCadFile(),
    })).toBe(true);
  });
  it('returns false when processingComplete is false', () => {
    expect(isUploadItemReady({
      status: 'ready', validationState: 'valid', processingComplete: false, cadFile: readyCadFile(),
    })).toBe(false);
  });
  it('returns false when validationState is not valid', () => {
    expect(isUploadItemReady({
      status: 'ready', validationState: 'pending', processingComplete: true, cadFile: readyCadFile(),
    })).toBe(false);
  });
  it('returns false when status is uploading', () => {
    expect(isUploadItemReady({
      status: 'uploading', validationState: 'pending', processingComplete: false,
    })).toBe(false);
  });
});

/* A 2D drawing (DXF): analysed by the backend with viewer geometry, but no
   volume/surface area — quote-ineligible, yet thumbnail-eligible. */
const dxfCadFile = (overrides?: Partial<NonNullable<CadFile['latestVersion']>> & { metadata?: TestMetadata }): CadFile =>
  ({
    id: 'cf-dxf', name: 'drawing.dxf', format: 'DXF', size: '12 KB', uploaded: '2025-01-01',
    status: 'Verified CAD',
    latestVersion: {
      id: 'v-dxf', version: 1, scanStatus: 'CLEAN', processingStatus: 'COMPLETE',
      metadata: { geometryStatus: 'READY', viewerAsset: { available: true, format: 'glb' }, ...(overrides?.metadata ?? {}) },
      ...overrides,
    },
  } as unknown as CadFile);

describe('hasViewerGeometry', () => {
  it('returns true for a fully processed model with volume metadata', () => {
    expect(hasViewerGeometry(readyCadFile())).toBe(true);
  });
  it('returns true for an analysed 2D drawing that has no volume', () => {
    expect(hasViewerGeometry(dxfCadFile())).toBe(true);
  });
  it('returns false while processing is in flight', () => {
    expect(hasViewerGeometry(dxfCadFile({ processingStatus: 'PENDING' }))).toBe(false);
  });
  it('returns false when geometryStatus is not READY', () => {
    expect(hasViewerGeometry(dxfCadFile({ metadata: { geometryStatus: 'PENDING' } }))).toBe(false);
  });
  it('returns false when the version failed validation', () => {
    expect(hasViewerGeometry(dxfCadFile({
      metadata: { geometryStatus: 'READY', supportLevel: 'FAILED_VALIDATION' },
    }))).toBe(false);
  });
  it('returns false when the backend rejected the file', () => {
    expect(hasViewerGeometry(dxfCadFile({ processingStatus: 'FAILED' }))).toBe(false);
  });
  it('returns false for undefined input', () => {
    expect(hasViewerGeometry(undefined)).toBe(false);
  });
});

describe('isUploadItemThumbnailReady', () => {
  it('returns true for a ready item with a healthy cadFile', () => {
    expect(isUploadItemThumbnailReady({
      status: 'ready', validationState: 'valid', processingComplete: true, cadFile: readyCadFile(),
    })).toBe(true);
  });
  it('returns true for a ready 2D drawing item that is quote-ineligible', () => {
    expect(isCadFileReady(dxfCadFile())).toBe(false);
    expect(isUploadItemReady({
      status: 'ready', validationState: 'valid', processingComplete: true, cadFile: dxfCadFile(),
    })).toBe(false);
    expect(isUploadItemThumbnailReady({
      status: 'ready', validationState: 'valid', processingComplete: true, cadFile: dxfCadFile(),
    })).toBe(true);
  });
  it('returns true for a duplicate 2D drawing item', () => {
    expect(isUploadItemThumbnailReady({
      status: 'duplicate', validationState: 'valid', processingComplete: true, cadFile: dxfCadFile(),
    })).toBe(true);
  });
  it('returns false when processing is incomplete', () => {
    expect(isUploadItemThumbnailReady({
      status: 'ready', validationState: 'valid', processingComplete: false, cadFile: dxfCadFile(),
    })).toBe(false);
  });
  it('returns false for an invalid file', () => {
    expect(isUploadItemThumbnailReady({
      status: 'ready', validationState: 'invalid', processingComplete: true, cadFile: dxfCadFile(),
    })).toBe(false);
  });
});

describe('areAllUploadsReady', () => {
  it('returns false for an empty list', () => {
    expect(areAllUploadsReady([])).toBe(false);
  });
  it('returns true when all items are ready', () => {
    expect(areAllUploadsReady([
      { status: 'ready', validationState: 'valid', processingComplete: true, cadFile: readyCadFile() },
    ])).toBe(true);
  });
  it('returns false if any item is not ready', () => {
    expect(areAllUploadsReady([
      { status: 'ready', validationState: 'valid', processingComplete: true, cadFile: readyCadFile() },
      { status: 'uploading', validationState: 'pending', processingComplete: false },
    ])).toBe(false);
  });
});

describe('hasUploadInFlight', () => {
  it('returns false for an empty list', () => {
    expect(hasUploadInFlight([])).toBe(false);
  });
  it('returns true when any item is uploading', () => {
    expect(hasUploadInFlight([{ status: 'uploading' }])).toBe(true);
  });
  it('returns true when any item is scanning', () => {
    expect(hasUploadInFlight([{ status: 'scanning' }])).toBe(true);
  });
  it('returns true when any item is processing', () => {
    expect(hasUploadInFlight([{ status: 'processing' }])).toBe(true);
  });
  it('returns false when all items are idle or ready', () => {
    expect(hasUploadInFlight([{ status: 'idle' }, { status: 'ready' }])).toBe(false);
  });
});

describe('hasBlockingUploadState', () => {
  it('returns true for an empty list', () => {
    expect(hasBlockingUploadState([])).toBe(true);
  });
  it('returns false when every item is ready', () => {
    expect(hasBlockingUploadState([
      { status: 'ready', validationState: 'valid', processingComplete: true, cadFile: readyCadFile() },
    ])).toBe(false);
  });
  it('returns true if any item is not ready', () => {
    expect(hasBlockingUploadState([
      { status: 'ready', validationState: 'valid', processingComplete: true, cadFile: readyCadFile() },
      { status: 'uploading' },
    ])).toBe(true);
  });
});