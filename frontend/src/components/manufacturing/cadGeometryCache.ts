import * as THREE from 'three';
import { ApiService, CadGeometryData } from '../../services/api';
import { CadFile } from '../../types';
import { CadGeometryUnavailableError, SUPPORTED_GEOMETRY_FORMATS, disposeCadModel, parseCadBuffer } from './cadGeometryLoaders';

/**
 * Deduplicated CAD geometry pipeline.
 *
 * Before this module, the interactive viewer and the thumbnail renderer each
 * performed the SAME three network calls (`getCadGeometry` -> metadata,
 * `getCadViewerAsset` -> binary) and then SAME CPU parse (`parseCadBuffer`) for
 * the SAME immutable file version — 2× fetch, 2× parse per uploaded file (3× on
 * preview modal open).
 *
 * This module makes two guarantees:
 *
 * 1. METADATA: `fetchCadGeometry` returns one in-flight Promise per file version
 *    and only CACHES terminal (COMPLETE + READY) metadata. Processing artifacts
 *    are never cached, so polling/retry always sees fresh backend state.
 *
 * 2. MODEL: one file version is FETCHED and PARSED exactly once regardless of
 *    how many consumers (viewer, thumbnail, preview modal) ask for it. Each
 *    caller receives its own deep CLONE with fresh material instances and takes
 *    a refcount; the template (and its shared geometry) is disposed only when
 *    the last consumer releases. Clones must dispose materials only —
 *    `disposeCadClone` for that, never `disposeCadModel`.
 *
 * Cache keys are `fileId:versionId` — immutable per backend reprocess, so a
 * retry produces a new version id and can never return stale geometry.
 */

export interface CadModelHandle {
  model: THREE.Object3D;
  is2D: boolean;
  release: () => void;
}

interface ModelEntry {
  template: THREE.Object3D | null;
  pending: Promise<THREE.Object3D> | null;
  refs: number;
  lastUsed: number;
  disposeTimer: number | null;
  is2D: boolean;
}

/** Single indirection so the DOM vs Nodejs setTimeout typing never leaks into
    cache bookkeeping (browsers hand out numeric handles; Node objects accept
    them in clearTimeout either way). */
const scheduleDispose = (callback: () => void, delay: number): number =>
  window.setTimeout(callback, delay) as unknown as number;

const versionKey = (file: CadFile): string => `${file.id}:${file.latestVersion?.id ?? 'latest'}`;

const MAX_METADATA_ENTRIES = 32;
const MAX_MODEL_ENTRIES = 16;
/* After the last consumer releases, the parsed template (and its shared GPU
   geometry) is not torn down immediately: active render loops may still be
   flushing a frame or two inside the same commit, and React 18 StrictMode
   re-mounts effects back-to-back in dev. A short grace window lets a
   re-acquire reuse the same template (no re-fetch, no re-parse, no churn) while
   still guaranteeing the geometry is freed promptly once idle. */
const MODEL_DISPOSE_GRACE_MS = 1500;

/* ── Metadata dedup ─────────────────────────────────────────────────────── */

const metadataCache = new Map<string, Promise<CadGeometryData>>();

const isTerminalReady = (data: CadGeometryData): boolean => Boolean(
  data.status === 'COMPLETE'
  && data.metadata?.geometryStatus === 'READY'
  && data.metadata?.viewerAsset?.available
);

export const fetchCadGeometry = (file: CadFile): Promise<CadGeometryData> => {
  const key = versionKey(file);
  const cached = metadataCache.get(key);
  if (cached) return cached;
  const attempt = ApiService.getCadGeometry(file.id, file.latestVersion?.id)
    .then((data) => {
      if (!data) throw new CadGeometryUnavailableError('No geometry data returned.');
      // Only terminal, ready metadata is safe to cache. Anything else (scanning,
      // processing, COMPLETE-but-unavailable) must stay transient so retries and
      // the processing poll always observe live backend state.
      if (!isTerminalReady(data)) metadataCache.delete(key);
      return data;
    })
    .catch((error) => { metadataCache.delete(key); throw error; });
  if (metadataCache.size >= MAX_METADATA_ENTRIES) {
    const first = metadataCache.keys().next().value;
    if (first !== undefined) metadataCache.delete(first);
  }
  metadataCache.set(key, attempt);
  return attempt;
};

/* ── Parsed-model cache (refcounted clones) ─────────────────────────────── */

const modelCache = new Map<string, ModelEntry>();

const cloneCadModel = (template: THREE.Object3D): THREE.Object3D => {
  const clone = template.clone(true);
  clone.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      const asArray = Array.isArray(object.material);
      const materials = asArray ? object.material : [object.material];
      const cloned = materials.map((material: THREE.Material | THREE.Material[] | undefined) => {
        if (!material) return material;
        if (Array.isArray(material)) return material.map((m) => m?.clone());
        return material.clone();
      });
      object.material = (asArray ? cloned : cloned[0]) as THREE.Material | THREE.Material[];
    }
  });
  return clone;
};

const disposeAndEvict = (key: string): void => {
  const entry = modelCache.get(key);
  if (!entry || entry.refs > 0) return;
  if (entry.disposeTimer) { clearTimeout(entry.disposeTimer); entry.disposeTimer = null; }
  if (entry.template) disposeCadModel(entry.template);
  modelCache.delete(key);
};

const evictIdleModels = (): void => {
  if (modelCache.size <= MAX_MODEL_ENTRIES) return;
  const idle = [...modelCache.entries()].filter(([, entry]) => entry.refs === 0);
  if (!idle.length) return;
  idle.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [key] of idle) disposeAndEvict(key);
};

export const acquireCadModel = async (file: CadFile): Promise<CadModelHandle> => {
  const key = versionKey(file);
  const data = await fetchCadGeometry(file);
  const ready = isTerminalReady(data) && SUPPORTED_GEOMETRY_FORMATS.includes(data.format);
  if (!ready) throw new CadGeometryUnavailableError('Geometry is not ready for viewing.');
  const is2D = data.format === 'DXF' || data.metadata?.geometryKind === '2D';
  const format = data.format;

  let entry = modelCache.get(key);
  if (!entry) {
    entry = { template: null, pending: null, refs: 0, lastUsed: Date.now(), disposeTimer: null, is2D };
    modelCache.set(key, entry);
  } else if (entry.refs === 0 && entry.disposeTimer) {
    // Re-acquired within the disposal grace window — keep the parsed template.
    clearTimeout(entry.disposeTimer);
    entry.disposeTimer = null;
  }
  entry.refs += 1;
  entry.lastUsed = Date.now();

  try {
    if (!entry.template) {
      if (!entry.pending) {
        entry.pending = (async () => {
          const blob = await ApiService.getCadViewerAsset(file.id, file.latestVersion?.id);
          const template = await parseCadBuffer(format, await blob.arrayBuffer());
          entry!.template = template;
          return template;
        })();
      }
      await entry.pending;
    }
  } catch (error) {
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs === 0) disposeAndEvict(key);
    else evictIdleModels();
    throw error;
  }

  const template = entry.template as THREE.Object3D;
  const model = cloneCadModel(template);
  let released = false;
  return {
    model,
    is2D,
    release: () => {
      if (released) return;
      released = true;
      const current = modelCache.get(key);
      if (!current) return;
      current.refs = Math.max(0, current.refs - 1);
      current.lastUsed = Date.now();
      if (current.refs === 0 && !current.disposeTimer) {
        // Deferred teardown: absorb the render-loop tail and React 18 StrictMode
        // dev double-mount without ever touching live GPU geometry.
        current.disposeTimer = scheduleDispose(() => disposeAndEvict(key), MODEL_DISPOSE_GRACE_MS);
      }
      evictIdleModels();
    },
  };
};

/** Disposes the materials owned by a cache HANDLE's clone. Shared geometry is
    owned by the cached template and must never be disposed here. */
export const disposeCadClone = (model: THREE.Object3D): void => {
  model.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    }
  });
};

export const resetCadGeometryCache = (): void => {
  metadataCache.clear();
  for (const entry of modelCache.values()) {
    if (entry.disposeTimer) clearTimeout(entry.disposeTimer);
    if (entry.template && entry.refs === 0) disposeCadModel(entry.template);
  }
  modelCache.clear();
};

/** Test hook (harmless in production): immediately disposes every idle
    template instead of waiting for the grace window. */
export const flushCadGeometryCache = (): void => {
  for (const entry of modelCache.values()) {
    if (entry.refs === 0) {
      if (entry.disposeTimer) clearTimeout(entry.disposeTimer);
      if (entry.template) disposeCadModel(entry.template);
    }
  }
  for (const [key, entry] of [...modelCache.entries()]) {
    if (entry.refs === 0) modelCache.delete(key);
  }
};

export const cadModelCacheSize = (): number => modelCache.size;