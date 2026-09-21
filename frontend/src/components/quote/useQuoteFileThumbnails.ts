import { useEffect, useMemo, useState } from 'react';
import type { CadFile } from '../../types';
import { renderCadThumbnail } from '../manufacturing/cadThumbnailRenderer';
import { hasViewerGeometry } from '../manufacturing/uploadState';
import { CAPTURE_FORMATS, MAX_CONCURRENT_THUMBNAILS, THUMB_GRACE_MS } from '../manufacturing/workspace/thumbnailQueue';

export type QuoteThumbState = 'ready' | 'loading' | 'processing' | 'failed';

/**
 * Real CAD geometry thumbnails for the Submit Quote summary.
 *
 * Reuses the existing single-context thumbnail pipeline
 * (`renderCadThumbnail` + shared `cadGeometryCache`): one static PNG frame per
 * backend file through ONE lazily-created WebGL context, serialized through a
 * module queue — never one live 3D viewer per card, never a re-render per
 * React commit. Frames are cached per `cadFile.id` at module level so
 * remounts (and the workspace, when it rendered the same file) never pay twice.
 *
 * States:
 *  - ready:      data URL of the exact uploaded file's geometry
 *  - loading:    renderable file whose frame is being generated (skeleton)
 *  - processing: backend analysis not COMPLETE/READY yet
 *  - failed:     unsupported format or generation failure (neutral CAD fallback)
 */
const frameCache = new Map<string, string>();
const failedCache = new Set<string>();

const isRenderableFormat = (file: CadFile): boolean =>
  CAPTURE_FORMATS.includes(String((file as { format?: string }).format || '').toUpperCase());

export const useQuoteFileThumbnails = (files: CadFile[]): Record<string, { url: string | null; state: QuoteThumbState }> => {
  const idsKey = useMemo(() => files.map((f) => f.id).join('|'), [files]);
  const [frames, setFrames] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [activeIds, setActiveIds] = useState<string[]>([]);

  // Seed from the module cache so previously rendered files appear instantly.
  useEffect(() => {
    const seeded: Record<string, string> = {};
    const seedFailed: Record<string, true> = {};
    for (const f of files) {
      const cached = frameCache.get(f.id);
      if (cached) seeded[f.id] = cached;
      else if (failedCache.has(f.id)) seedFailed[f.id] = true;
    }
    if (Object.keys(seeded).length) setFrames((prev) => ({ ...seeded, ...prev }));
    if (Object.keys(seedFailed).length) setFailed((prev) => ({ ...seedFailed, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Grace fallback: a stalled generation degrades to the neutral icon.
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
        !frameCache.has(f.id) &&
        !failedCache.has(f.id) &&
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
            frameCache.set(id, dataUrl);
            setFrames((prev) => (prev[id] ? prev : { ...prev, [id]: dataUrl }));
            setActiveIds((prev) => prev.filter((x) => x !== id));
          })
          .catch(() => {
            if (cancelled) return;
            failedCache.add(id);
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
    const out: Record<string, { url: string | null; state: QuoteThumbState }> = {};
    for (const f of files) {
      if (frames[f.id] || frameCache.get(f.id)) {
        out[f.id] = { url: frames[f.id] || frameCache.get(f.id) || null, state: 'ready' };
      } else if (failed[f.id] || failedCache.has(f.id) || !isRenderableFormat(f)) {
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
