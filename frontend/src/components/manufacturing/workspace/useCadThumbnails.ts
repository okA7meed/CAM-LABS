import { useEffect, useMemo, useRef, useState } from 'react';
import { renderCadThumbnail } from '../cadThumbnailRenderer';
import { activeThumbIdsFor, pendingThumbIds, THUMB_GRACE_MS } from './thumbnailQueue';
import { FileConfiguration, RequestState, UploadItem } from './types';

/**
 * Shared CAD thumbnail store for the whole workspace page.
 *
 * There is exactly ONE instance (owned by ManufacturingWorkspaceView), so the
 * Upload Design rows and the Proposed Technical Quote rows reference the SAME
 * cached data URL for a given UploadItem id — a thumbnail is generated once per
 * file, never per panel and never twice.
 *
 * The raw cached data URLs are keyed by UploadItem.id (a stable crypto UUID),
 * never by array index or file name. `activeThumbIds` mirrors the two-at-a-time
 * generation window so both panels can show a spinner while a file's frame is
 * being rendered, and the 10s grace timer turns a stalled/failed job into a
 * graceful generic-file fallback instead of an infinite spinner.
 */
/* A transient WebGL/renderer failure must not lock a file on the generic icon
   forever: each id gets one bounded retry before the grace fallback. */
const MAX_THUMB_ATTEMPTS = 2;

export const useCadThumbnails = ({ uploadItems, fileConfigurations, request, enabled = true }: {
  uploadItems: UploadItem[];
  fileConfigurations: Record<string, FileConfiguration>;
  request: RequestState;
  enabled?: boolean;
}) => {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [thumbFailed, setThumbFailed] = useState<Record<string, true>>({});
  const [retryTick, setRetryTick] = useState(0);
  const attemptsRef = useRef<Record<string, number>>({});
  const byCadFileRef = useRef<Record<string, string>>({});
  const byCadFileFailedRef = useRef<Record<string, true>>({});

  const materialIdFor = (item: UploadItem): string | null => {
    if (!item.cadFile) return null;
    const cfg = fileConfigurations[item.cadFile.id];
    return (cfg && cfg.material) || request.material || null;
  };

  const colorIdFor = (item: UploadItem): string | null => {
    if (!item.cadFile) return null;
    const cfg = fileConfigurations[item.cadFile.id];
    return (cfg && cfg.color) || request.color || null;
  };

  const pendingIds = pendingThumbIds(uploadItems, thumbnails, thumbFailed);
  const activeThumbIds = activeThumbIdsFor(pendingIds);

  /* A stalled/errored geometry load should not leave a spinner forever — fall
     back to the generic file icon after a grace period (honest unavailable).
     Gated like the render window: once the reveal enables generation, the clock
     starts for whatever is actually being fetched. */
  useEffect(() => {
    if (!enabled || activeThumbIds.length === 0) return;
    const timers = activeThumbIds.map((id) => (
      window.setTimeout(() => {
        setThumbFailed((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
      }, THUMB_GRACE_MS)
    ));
    return () => { timers.forEach((id) => window.clearTimeout(id)); };
  }, [enabled, activeThumbIds.join('|'), thumbnails, thumbFailed]);

  /* Hand the active window to the shared single-context renderer. Each completed
     frame is cached in panel state; on failure the file is marked failed so the
     UI falls back gracefully. StrictMode-safe: a `cancelled` guard prevents an
     unmounted effect from writing stale state.
     - `enabled` (false until the reveal phase) keeps the thumbnail burst from
       competing with the interactive viewer's first frame during the entry.
     - Work is scheduled on requestAnimationFrame so it always starts after a
       painted frame, never synchronously inside the reveal commit.
     - Completed frames are ALSO cached per `cadFile.id`, so a delete/re-add that
       reuses the same backend file (or a duplicate upload mapping to the same
       cadFile) is seeded instantly instead of re-rendered. */
  useEffect(() => {
    uploadItems.forEach((item) => {
      if (!item.cadFile) return;
      const cached = byCadFileRef.current[item.cadFile.id];
      if (cached) {
        setThumbnails((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: cached }));
      } else if (byCadFileFailedRef.current[item.cadFile.id]) {
        setThumbFailed((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: true }));
      }
    });
  }, [uploadItems, thumbnails, thumbFailed]);

  useEffect(() => {
    if (!enabled || activeThumbIds.length === 0) return;
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      activeThumbIds.forEach((id) => {
        const item = uploadItems.find((candidate) => candidate.id === id);
        if (!item?.cadFile) return;
        renderCadThumbnail({ file: item.cadFile, materialId: materialIdFor(item), colorId: colorIdFor(item) })
          .then((dataUrl) => {
            if (!cancelled) {
              byCadFileRef.current[item.cadFile!.id] = dataUrl;
              setThumbnails((prev) => (prev[id] ? prev : { ...prev, [id]: dataUrl }));
            }
          })
          .catch(() => {
            if (cancelled) return;
            if (item.cadFile) byCadFileFailedRef.current[item.cadFile.id] = true;
            const attempt = (attemptsRef.current[id] || 0) + 1;
            attemptsRef.current[id] = attempt;
            if (attempt >= MAX_THUMB_ATTEMPTS) {
              setThumbFailed((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
              return;
            }
            setRetryTick((tick) => tick + 1);
          });
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(rafId); };
  }, [activeThumbIds.join('|'), retryTick, enabled]);

  return useMemo(() => ({ thumbnails, thumbFailed, activeThumbIds }), [thumbnails, thumbFailed, activeThumbIds]);
};