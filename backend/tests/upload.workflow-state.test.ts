import { describe, expect, it } from 'vitest';
import { areAllUploadsReady, hasBlockingUploadState, hasUploadInFlight, isCadFileReady, isUploadItemReady } from '../../frontend/src/components/manufacturing/uploadState';

const readyCadFile = (overrides: Record<string, unknown> = {}) => {
  const { latestVersion, ...fileOverrides } = overrides as { latestVersion?: Record<string, unknown> } & Record<string, unknown>;
  return {
    id: 'file-ready',
    name: 'part.stl',
    format: 'STL',
    size: '1.00 MB',
    uploaded: '2026-08-20',
    volume: '10 cm3',
    dimensions: '10 x 10 x 10 mm',
    meshTriangles: '4',
    status: 'Verified CAD',
    latestVersion: {
    version: 1,
    scanStatus: 'CLEAN',
    processingStatus: 'COMPLETE',
    metadata: { geometryStatus: 'READY', supportLevel: 'FULLY_SUPPORTED', volume: 10, surfaceArea: 20, dimensions: { width: 10, height: 10, depth: 10 } },
      ...latestVersion,
    },
    ...fileOverrides,
  } as any;
};

const readyItem = (overrides: Record<string, unknown> = {}) => ({
  status: 'ready',
  validationState: 'valid',
  processingComplete: true,
  cadFile: readyCadFile(),
  ...overrides,
}) as any;

describe('upload workflow state machine', () => {
  it('allows a valid processed file and blocks upload/processing states', () => {
    expect(isCadFileReady(readyCadFile())).toBe(true);
    expect(isUploadItemReady(readyItem())).toBe(true);
    expect(areAllUploadsReady([readyItem()])).toBe(true);

    for (const status of ['uploading', 'scanning', 'processing'] as const) {
      const item = readyItem({ status, validationState: 'pending', processingComplete: false });
      expect(isUploadItemReady(item)).toBe(false);
      expect(hasUploadInFlight([item])).toBe(true);
      expect(hasBlockingUploadState([item])).toBe(true);
    }
  });

  it.each([
    ['unsupported', { status: 'unsupported', validationState: 'invalid', processingComplete: false, cadFile: undefined }],
    ['failed', { status: 'failed', validationState: 'invalid', processingComplete: false }],
    ['missing file id', { cadFile: readyCadFile({ id: undefined }) }],
    ['missing processing completion flag', { processingComplete: false }],
    ['missing validation flag', { validationState: 'pending' }],
    ['missing metadata', { cadFile: readyCadFile({ latestVersion: { metadata: null } }) }],
    ['invalid geometry', { cadFile: readyCadFile({ latestVersion: { metadata: { geometryStatus: 'UNAVAILABLE', supportLevel: 'FAILED_VALIDATION' } } }) }],
    ['missing volume', { cadFile: readyCadFile({ latestVersion: { metadata: { geometryStatus: 'READY', supportLevel: 'FULLY_SUPPORTED', surfaceArea: 20, dimensions: { width: 10, height: 10, depth: 10 } } } }) }],
  ])('blocks %s files', (_label, update) => {
    expect(isUploadItemReady(readyItem(update))).toBe(false);
    expect(areAllUploadsReady([readyItem(update)])).toBe(false);
  });

  it('blocks multi-file continuation until every file is ready', () => {
    const fileA = readyItem({ cadFile: readyCadFile({ id: 'file-a' }) });
    const fileB = readyItem({ cadFile: readyCadFile({ id: 'file-b' }) });
    const processing = readyItem({ status: 'processing', validationState: 'pending', processingComplete: false, cadFile: readyCadFile({ id: 'file-c', latestVersion: { processingStatus: 'PROCESSING' } }) });
    const failed = readyItem({ status: 'failed', validationState: 'invalid', processingComplete: false, cadFile: readyCadFile({ id: 'file-d', latestVersion: { processingStatus: 'FAILED' } }) });
    const unsupported = readyItem({ status: 'unsupported', validationState: 'invalid', processingComplete: false, cadFile: undefined });

    expect(areAllUploadsReady([fileA, fileB])).toBe(true);
    expect(areAllUploadsReady([fileA, processing])).toBe(false);
    expect(areAllUploadsReady([fileA, failed])).toBe(false);
    expect(areAllUploadsReady([fileA, unsupported])).toBe(false);
  });

  it('blocks stale replacement and removal states until the new active file is ready', () => {
    const oldReady = readyItem({ cadFile: readyCadFile({ id: 'old-file' }) });
    const replacementProcessing = readyItem({ status: 'processing', validationState: 'pending', processingComplete: false, cadFile: readyCadFile({ id: 'new-file', latestVersion: { processingStatus: 'PROCESSING' } }) });

    expect(areAllUploadsReady([oldReady])).toBe(true);
    expect(areAllUploadsReady([replacementProcessing])).toBe(false);
    expect(areAllUploadsReady([])).toBe(false);
  });
});