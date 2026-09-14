import { isUploadItemThumbnailReady } from '../uploadState';
import { UploadItem } from './types';

/* Formats the one-shot thumbnail renderer can capture from real geometry.
   SVG/PDF render as documents and fall back to the generic file icon instead.
   DXF is a first-class 2D capture target: every uploaded file that the backend
   analysed should show a real thumbnail of its geometry. */
export const CAPTURE_FORMATS = ['STL', 'OBJ', 'PLY', 'DXF', 'STEP', 'STP', 'IGES', 'IGS'];

/* At most this many off-screen thumbnail renderers are alive at once, so a
   large upload batch never spins up unbounded WebGL contexts. */
export const MAX_CONCURRENT_THUMBNAILS = 2;

/* Grace period before an in-flight thumbnail generation is declared failed and
   falls back to the generic file icon (guarantees the spinner never sticks). */
export const THUMB_GRACE_MS = 10000;

export const thumbnailMatches = (item: UploadItem): boolean => Boolean(
  item.cadFile
  && isUploadItemThumbnailReady(item)
  && CAPTURE_FORMATS.includes((item.format || '').toUpperCase())
);

/* Files that still need a thumbnail, in upload order. Already-generated and
   failed entries are skipped so work is never repeated. */
export const pendingThumbIds = (items: UploadItem[], thumbnails: Record<string, string>, thumbFailed: Record<string, true>): string[] =>
  items
    .filter((item) => thumbnailMatches(item) && !thumbnails[item.id] && !thumbFailed[item.id])
    .map((item) => item.id);

/* The fixed-size generation window: only the first pending files render right
   now; completed slot frees automatically as thumbnails settle. */
export const activeThumbIdsFor = (ids: string[]): string[] => ids.slice(0, MAX_CONCURRENT_THUMBNAILS);