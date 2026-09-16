import { Material } from '../../types';
import { IconName } from '../ui/Icon';

/**
 * Data-driven material thumbnail mapping.
 *
 * The catalog (PostgreSQL `materials` table) carries no image assets, and the
 * repo ships no per-material imagery under `frontend/public`. Rather than
 * referencing nonexistent local files or unstable external URLs, every
 * material resolves here to an explicit technical thumbnail built from the
 * existing internal Icon system + design tokens.
 *
 * Each catalog id has an explicit entry so the visual corresponds to the
 * actual material (polymer cube, sheet-metal stack, machined alloy, …).
 * Unknown ids fall back to a technology/category-based visual, so future
 * backend catalog additions still render a coherent thumbnail.
 *
 * LIMITATION (documented per spec §18): these are stylized technical
 * glyphs, not photorealistic material photography. Swapping in real photos
 * later only requires extending `MATERIAL_VISUALS_BY_ID` with an image
 * source — the card layout already isolates the thumbnail in one container.
 */
export type MaterialVisualTone = 'polymer' | 'metal' | 'resin' | 'performance' | 'elastomer';

export interface MaterialVisual {
  icon: IconName;
  tone: MaterialVisualTone;
}

const MATERIAL_VISUALS_BY_ID: Record<string, MaterialVisual> = {
  // FDM engineering polymers
  pla: { icon: 'cube', tone: 'polymer' },
  abs: { icon: 'cube', tone: 'polymer' },
  petg: { icon: 'layers', tone: 'polymer' },
  // SLS nylons
  'pa12-sls': { icon: 'layers3', tone: 'polymer' },
  'pa11-sls': { icon: 'layers3', tone: 'polymer' },
  // High-performance polymers
  'peek-fdm': { icon: 'shieldCheck', tone: 'performance' },
  'ultem-9085-fdm': { icon: 'shieldCheck', tone: 'performance' },
  // SLA precision resins
  'sla-tough-resin': { icon: 'precision', tone: 'resin' },
  'sla-high-temp': { icon: 'precision', tone: 'resin' },
  // CNC metals
  'alu-6061-cnc': { icon: 'technology', tone: 'metal' },
  'ss-316l-cnc': { icon: 'gear', tone: 'metal' },
  // DMLS titanium
  'ti-6al4v-dmls': { icon: 'cpu', tone: 'metal' },
  // Sheet metal
  'sheet-alu-5052': { icon: 'layers', tone: 'metal' },
  // Elastomers
  tpu: { icon: 'scaling', tone: 'elastomer' },
  'tpu-95a-fdm': { icon: 'scaling', tone: 'elastomer' },
};

const TECHNOLOGY_FALLBACK: Record<string, MaterialVisual> = {
  FDM: { icon: 'cube', tone: 'polymer' },
  SLS: { icon: 'layers3', tone: 'polymer' },
  SLA: { icon: 'precision', tone: 'resin' },
  CNC: { icon: 'technology', tone: 'metal' },
  DMLS: { icon: 'cpu', tone: 'metal' },
  'Sheet Metal': { icon: 'layers', tone: 'metal' },
};

export const getMaterialVisual = (material: Material): MaterialVisual => {
  const byId = MATERIAL_VISUALS_BY_ID[material.id];
  if (byId) return byId;
  const byTech = TECHNOLOGY_FALLBACK[material.technology];
  if (byTech) return byTech;
  if (material.category === 'Elastomers') return { icon: 'scaling', tone: 'elastomer' };
  if (material.category === 'Resins') return { icon: 'precision', tone: 'resin' };
  if (material.category === 'High-Performance') return { icon: 'shieldCheck', tone: 'performance' };
  if (material.category === 'Metals') return { icon: 'technology', tone: 'metal' };
  return { icon: 'cube', tone: 'polymer' };
};
