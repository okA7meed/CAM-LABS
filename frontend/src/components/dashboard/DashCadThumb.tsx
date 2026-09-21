import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CadFile } from '../../types';
import { Icon } from '../ui/Icon';
import { dedupExtensions, fileExtension, stackOverflowCount } from './dashUtils';
import type { DashThumbState } from './useDashboardThumbnails';

export interface DashThumbInfo {
  url: string | null;
  state: DashThumbState;
}

/**
 * Real CAD preview tile for a dashboard recent row.
 *
 * - Single file: one framed render of the PRIMARY file geometry.
 * - Multi-file: stacked preview (primary frame on top, muted back layer) +
 *   `+N` badge. Only the primary file is ever rendered — secondaries are
 *   represented, never fetched — so dashboard cost stays at one frame/row.
 * - Fallback (loading/processing/failed): technical tile with the real
 *   extension (STL/STEP/…) — never a broken image, never stock imagery.
 */
export const DashCadThumb: React.FC<{
  files: CadFile[];
  primary: CadFile | null;
  thumb: DashThumbInfo | undefined;
  alt: string;
}> = ({ files, primary, thumb, alt }) => {
  const { t } = useTranslation();
  const total = files.length;
  const overflow = stackOverflowCount(total, 1);
  const multi = total > 1;
  const ext = fileExtension(primary?.name) || String(primary?.format || '').toUpperCase();
  const fileNames = files.map((f) => f.name).filter(Boolean);

  const frame = thumb?.url ? (
    <img className="dash-thumb-img" src={thumb.url} alt={alt} draggable={false} loading="lazy" />
  ) : (
    <span
      className={`dash-thumb-fallback${thumb?.state === 'loading' || thumb?.state === 'processing' ? ' is-loading' : ''}`}
      role="img"
      aria-label={
        thumb?.state === 'loading' || thumb?.state === 'processing'
          ? t('dashboard.previewLoading', { name: alt })
          : t('dashboard.previewUnavailable', { name: alt })
      }
    >
      <Icon name="cube" size={26} />
      {ext && (
        <span className="dash-thumb-ext" dir="ltr">
          {ext}
        </span>
      )}
      {(thumb?.state === 'loading' || thumb?.state === 'processing') && (
        <span className="dash-thumb-spinner" aria-hidden="true" />
      )}
    </span>
  );

  if (!multi) {
    return (
      <span className="dash-thumb is-single" aria-hidden={Boolean(thumb?.url)}>
        {frame}
      </span>
    );
  }

  const extensions = dedupExtensions(files);
  const overview = t('dashboard.fileOverview', {
    count: total,
    names: fileNames.slice(0, 5).join(', '),
  });

  return (
    <span
      className="dash-thumb is-stack"
      aria-hidden={Boolean(thumb?.url)}
      title={overview}
    >
      <span className="dash-thumb-back" aria-hidden="true" />
      {frame}
      {overflow > 0 && (
        <span className="dash-thumb-count" dir="ltr" aria-hidden="true">
          +{overflow}
        </span>
      )}
      <span className="dash-thumb-ext-list" hidden>
        {extensions.join(', ')}
      </span>
    </span>
  );
};
