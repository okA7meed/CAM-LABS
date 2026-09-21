import React, { useEffect, useState } from 'react';
import { CadFile } from '../../../types';
import { renderCadThumbnail } from '../../manufacturing/cadThumbnailRenderer';
import { Icon } from '../../ui/Icon';

/**
 * Real CAD thumbnail: renders the ACTUAL uploaded geometry through the
 * project's shared pipeline (fetchCadGeometry -> acquireCadModel -> single
 * shared WebGL renderer -> PNG data URL). One static frame per file, jobs
 * serialized — no per-card WebGL contexts. Falls back to a muted glyph only
 * when geometry is unavailable or parsing fails.
 */
export const CadThumbnail: React.FC<{ file: CadFile; label: string }> = ({ file, label }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSrc(null);
    setFailed(false);
    renderCadThumbnail({ file })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [file.id, file.latestVersion?.id]);

  if (src) {
    return <img className="od-thumb-img" src={src} alt={`3D preview of ${label}`} draggable={false} />;
  }
  return (
    <div className="od-thumb-fallback" role="img" aria-label={failed ? `Preview unavailable for ${label}` : `Loading preview of ${label}`}>
      <Icon name="cube" size={30} />
      {!failed && <span className="od-thumb-loading" aria-hidden="true" />}
      {failed && <span className="od-thumb-failed">Preview unavailable</span>}
    </div>
  );
};
