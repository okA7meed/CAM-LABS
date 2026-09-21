import { useEffect, useMemo, useState } from 'react';
import type { CadFile } from '../../types';
import { renderCadThumbnail } from '../manufacturing/cadThumbnailRenderer';
import { hasViewerGeometry } from '../manufacturing/uploadState';
import { CAPTURE_FORMATS, MAX_CONCURRENT_THUMBNAILS, THUMB_GRACE_MS } from '../manufacturing/workspace/thumbnailQueue';

export type DashThumbState = 'ready' | 'loading' | 'processing' | 'failed';

/**
 * Dashboard CAD thumbnails — real geometry frames for recent Orders/Quotes.
 *
 * Reuses the existing single-context pipeline (`renderCadThumbnail` +
 * shared `cadGeometryCache`): one static PNG per backend file through ONE
 * lazily-created WebGL context, serialized queue, module-level frame cache
 * per `cadFile.id`. Never a live viewer per row.
 *
 * Only PRIMARY files are passed in by callers (one per recent row), so a
 * full dashboard renders at most RECENT_LIMIT × 2 frames with at most
 * MAX_CONCURRENT_THUMBNAILS in flight. Secondary files in a multi-file
 * record are represented by the stacked preview + count, never rendered.
 */
const frameCache = new Map<string, string>();
const failedCache = new Set<string>();

const cacheKey = (file: CadFile): string => `${file.id}:${file.latestVersion?.id ?? 'latest'}`;

const isRenderableFormat = (file: CadFile): boolean =>
  CAPTURE_FORMATS.includes(String((file as { format?: string }).format || '').toUpperCase());

export const useDashboardThumbnails = (files: CadFile[]): Record<string, { url: string | null; state: DashThumbState }> => {
  const idsKey = useMemo(() => files.map((f) => cacheKey(f)).join('|'), [files]);
  const [frames, setFrames] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [activeIds, setActiveIds] = useState<string[]>([]);

  useEffect(() => {
    const seeded: Record<string, string> = {};
    const seedFailed: Record<string, true> = {};
    for (const f of files) {
      const key = cacheKey(f);
      const cached = frameCache.get(key);
      if (cached) seeded[f.id] = cached;
      else if (failedCache.has(key)) seedFailed[f.id] = true;
    }
    if (Object.keys(seeded).length) setFrames((prev) => ({ ...seeded, ...prev }));
    if (Object.keys(seedFailed).length) setFailed((prev) => ({ ...seedFailed, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    if (activeIds.length === 0) return;
    const timers = activeIds.map((id) =>
      window.setTimeout(() => {
        setFailed((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
        setActiveIds((prev) => prev.filter((x) => x !== id));
      }, THUMB_GRACE_MS),
    );
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [activeIds]);

  useEffect(() => {
    let cancelled = false;
    const queue = files.filter(
      (f) =>
        hasViewerGeometry(f) &&
        isRenderableFormat(f) &&
        !frameCache.has(cacheKey(f)) &&
        !failedCache.has(cacheKey(f)) &&
        !frames[f.id] &&
        !failed[f.id],
    );
    if (queue.length === 0) {
      setActiveIds([]);
      return () => {
        cancelled = true;
      };
    }
    const windowIds = queue.slice(0, MAX_CONCURRENT_THUMBNAILS).map((f) => f.id);
    setActiveIds(windowIds);
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      windowIds.forEach((id) => {
        const file = files.find((f) => f.id === id);
        if (!file) return;
        renderCadThumbnail({ file })
          .then((dataUrl) => {
            if (cancelled) return;
            frameCache.set(cacheKey(file), dataUrl);
            setFrames((prev) => (prev[id] ? prev : { ...prev, [id]: dataUrl }));
            setActiveIds((prev) => prev.filter((x) => x !== id));
          })
          .catch(() => {
            if (cancelled) return;
            failedCache.add(cacheKey(file));
            setFailed((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
            setActiveIds((prev) => prev.filter((x) => x !== id));
          });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, Object.keys(frames).length, Object.keys(failed).length]);

  return useMemo(() => {
    const out: Record<string, { url: string | null; state: DashThumbState }> = {};
    for (const f of files) {
      if (frames[f.id] || frameCache.get(cacheKey(f))) {
        out[f.id] = { url: frames[f.id] || frameCache.get(cacheKey(f)) || null, state: 'ready' };
      } else if (failed[f.id] || failedCache.has(cacheKey(f)) || !isRenderableFormat(f)) {
        out[f.id] = { url: null, state: 'failed' };
      } else if (!hasViewerGeometry(f)) {
        const version = (f as { latestVersion?: { processingStatus?: string } | null }).latestVersion;
        out[f.id] = {
          url: null,
          state: version && version.processingStatus !== 'COMPLETE' ? 'processing' : 'failed',
        };
      } else {
        out[f.id] = { url: null, state: 'loading' };
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, frames, failed]);
};
