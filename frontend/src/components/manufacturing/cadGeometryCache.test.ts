import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ApiService, CadGeometryData } from '../../services/api';
import { CadFile } from '../../types';
import { acquireCadModel, cadModelCacheSize, fetchCadGeometry, flushCadGeometryCache, resetCadGeometryCache } from './cadGeometryCache';

const stlBuffer = (): ArrayBuffer => {
  const buffer = new ArrayBuffer(80 + 4 + 50);
  const view = new DataView(buffer);
  view.setUint32(80, 1, true);
  const floats = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  const base = 84;
  floats.forEach((value, index) => view.setFloat32(base + index * 4, value, true));
  return buffer;
};

const readyFile = (id = 'f1', versionId = 'v1'): CadFile => ({
  id,
  name: 'cube.stl',
  format: 'STL',
  size: '1',
  uploaded: '2026-01-01T00:00:00Z',
  volume: '',
  dimensions: '',
  meshTriangles: '',
  status: 'Verified CAD',
  latestVersion: {
    id: versionId,
    version: 1,
    scanStatus: 'CLEAN',
    processingStatus: 'COMPLETE',
    metadata: { geometryStatus: 'READY', viewerAsset: { available: true, format: 'STL' } },
  },
});

const readyMeta = (fileId: string, version = 1): CadGeometryData => ({
  fileId,
  version,
  format: 'STL',
  status: 'COMPLETE',
  scanStatus: 'CLEAN',
  metadata: { geometryStatus: 'READY', viewerAsset: { available: true, format: 'STL' }, geometryKind: '3D' },
  jobs: [{ operation: 'scan', status: 'DONE' }],
});

let geometryCounter = 0;
let assetCounter = 0;

beforeEach(() => {
  geometryCounter = 0;
  assetCounter = 0;
  resetCadGeometryCache();
  vi.spyOn(ApiService, 'getCadGeometry').mockImplementation(async () => {
    geometryCounter += 1;
    return readyMeta('f1');
  });
  vi.spyOn(ApiService, 'getCadViewerAsset').mockImplementation(async () => {
    assetCounter += 1;
    return new Blob([stlBuffer()]);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  resetCadGeometryCache();
});

describe('fetchCadGeometry', () => {
  it('dedupes concurrent requests for the same terminal-ready file', async () => {
    const file = readyFile();
    const first = fetchCadGeometry(file);
    const second = fetchCadGeometry(file);
    await Promise.all([first, second]);
    expect(geometryCounter).toBe(1);
  });

  it('reuses the cached promise for an identical call', async () => {
    const file = readyFile();
    const first = fetchCadGeometry(file);
    await first;
    const again = fetchCadGeometry(file);
    expect(again).toBe(first);
  });

  it('does NOT cache metadata for still-processing files (retries see live state)', async () => {
    const file = readyFile();
    vi.mocked(ApiService.getCadGeometry).mockImplementation(async () => ({
      fileId: 'f1',
      version: 1,
      format: 'STL',
      status: 'PROCESSING',
      scanStatus: 'SCANNING',
      metadata: { viewerAsset: null },
      jobs: [{ operation: 'scan', status: 'RUNNING' }],
    }));
    await fetchCadGeometry(file);
    await fetchCadGeometry(file);
    expect(vi.mocked(ApiService.getCadGeometry)).toHaveBeenCalledTimes(2);
  });
});

describe('acquireCadModel', () => {
  it('fetches and parses a file version ONCE regardless of consumer count', async () => {
    const file = readyFile();
    const [a, b] = await Promise.all([acquireCadModel(file), acquireCadModel(file)]);
    expect(assetCounter).toBe(1);
    expect(cadModelCacheSize()).toBe(1);
    a.release();
    b.release();
  });

  it('hands each consumer an independent clone but shares the parsed geometry', async () => {
    const file = readyFile();
    const [a, b] = await Promise.all([acquireCadModel(file), acquireCadModel(file)]);
    expect(a.model).not.toBe(b.model);
    const meshA = a.model as THREE.Mesh;
    const meshB = b.model as THREE.Mesh;
    expect((meshA as THREE.Mesh).geometry).toBe((meshB as THREE.Mesh).geometry);
    expect(meshA.material).not.toBe(meshB.material);
    a.release();
    b.release();
  });

  it('keeps the template alive until the LAST consumer releases', async () => {
    const file = readyFile();
    const a = await acquireCadModel(file);
    const b = await acquireCadModel(file);
    a.release();
    expect(cadModelCacheSize()).toBe(1);
    b.release();
    expect(cadModelCacheSize()).toBe(1);
    flushCadGeometryCache();
    expect(cadModelCacheSize()).toBe(0);
  });

  it('reuses the parsed template when a consumer re-acquires inside the grace window (StrictMode-safe)', async () => {
    const file = readyFile();
    const a = await acquireCadModel(file);
    a.release();
    expect(assetCounter).toBe(1);
    const b = await acquireCadModel(file);
    expect(assetCounter).toBe(1); // no re-fetch, no re-parse: grace reuse
    b.release();
    flushCadGeometryCache();
    expect(assetCounter).toBe(1);
    const c = await acquireCadModel(file);
    expect(assetCounter).toBe(2); // after eviction a clean parse happens again
    c.release();
  });

  it('rejects when the backend reports the geometry is not ready', async () => {
    vi.mocked(ApiService.getCadGeometry).mockImplementation(async () => ({
      fileId: 'f1',
      version: 1,
      format: 'STL',
      status: 'COMPLETE',
      scanStatus: 'CLEAN',
      metadata: { geometryStatus: 'UNAVAILABLE', viewerAsset: { available: false } },
      jobs: [{ operation: 'scan', status: 'FAILED' }],
    }));
    const file = readyFile();
    await expect(acquireCadModel(file)).rejects.toThrow();
    expect(cadModelCacheSize()).toBe(0);
  });

  it('keys the cache by file version so reprocessed files never return stale geometry', async () => {
    const first = readyFile('f1', 'v1');
    const a = await acquireCadModel(first);
    a.release();
    expect(assetCounter).toBe(1);
    const reprocessed = readyFile('f1', 'v2');
    const b = await acquireCadModel(reprocessed);
    expect(assetCounter).toBe(2);
    b.release();
  });
});