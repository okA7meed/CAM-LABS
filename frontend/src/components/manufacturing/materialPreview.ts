import * as THREE from 'three';

/**
 * Material preview presets — VISUAL ONLY.
 *
 * These presets describe the PBR surface response of the four supported FDM
 * thermoplastics (PLA / ABS / PETG / TPU) so the 3D Model Viewer renders the
 * selected manufacturing material as realistically as possible. They are
 * deliberately decoupled from the quotation engine: selecting a material still
 * drives pricing exactly as before, and this module only consumes that same
 * value to build a WebGL material.
 *
 * Base colour is applied separately from the surface response (see
 * `buildPreviewMaterial`), so e.g. PLA + red and PETG + red share the same hue
 * while keeping different finishes.
 *
 * The four profiles are tuned against real-world printed plastic and kept in
 * the same family (all opaque FDM thermoplastics, no metalness, no glass):
 *   PLA  — solid printed thermoplastic, semi-matte, soft controlled highlight.
 *   ABS  — dense engineering plastic, matte, dimmer highlight, low reflections.
 *   PETG — smooth glossy plastic, tighter speculars, stronger reflections.
 *   TPU  — soft flexible polymer, most subdued response, matte.
 */

export type PreviewMaterialId = 'pla' | 'abs' | 'petg' | 'tpu';

export interface PreviewMaterialPreset {
  /** Manufacturing material identifier (already used by config/quotes). */
  id: PreviewMaterialId;
  label: string;
  /** Surface micro-roughness — the primary differentiator between plastics. */
  roughness: number;
  /** Always 0 for these plastics — nothing here is metallic. */
  metalness: number;
  /** Specular response strength of the plastic base. */
  specularIntensity: number;
  /** How strongly the IBL environment is reflected on the surface. */
  envMapIntensity: number;
  /** Optional thin clearcoat layer (used for the glossier PETG finish only). */
  clearcoat?: number;
  clearcoatRoughness?: number;
  /** Subtle fabric-like tint that makes extruded plastic pick up broad sheen. */
  sheen?: number;
  sheenRoughness?: number;
}

export const PREVIEW_MATERIALS: Record<PreviewMaterialId, PreviewMaterialPreset> = {
  pla: {
    id: 'pla',
    label: 'PLA',
    roughness: 0.38,
    metalness: 0,
    specularIntensity: 0.55,
    envMapIntensity: 0.7,
    sheen: 0.55,
    sheenRoughness: 0.3,
  },
  abs: {
    id: 'abs',
    label: 'ABS',
    roughness: 0.6,
    metalness: 0,
    specularIntensity: 1.0,
    envMapIntensity: 0.42,
    sheen: 0.28,
    sheenRoughness: 0.5,
  },
  petg: {
    id: 'petg',
    label: 'PETG',
    roughness: 0.22,
    metalness: 0,
    specularIntensity: 1.0,
    envMapIntensity: 1.05,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  },
  tpu: {
    id: 'tpu',
    label: 'TPU',
    roughness: 0.82,
    metalness: 0,
    specularIntensity: 0.35,
    envMapIntensity: 0.22,
  },
};

export const DEFAULT_PREVIEW_MATERIAL: PreviewMaterialId = 'pla';

export const isPreviewMaterial = (id: unknown): id is PreviewMaterialId =>
  id === 'pla' || id === 'abs' || id === 'petg' || id === 'tpu';

export const resolvePreviewPreset = (materialId: string | null | undefined): PreviewMaterialPreset =>
  PREVIEW_MATERIALS[isPreviewMaterial(materialId) ? materialId : DEFAULT_PREVIEW_MATERIAL];

/**
 * User-selectable colour palette (shared with the Configuration UI — this is
 * the single source of truth for colour ids → hex, used by both the swatches
 * and the 3D preview so the model always matches the picker).
 */
export const MATERIAL_COLORS = ['any', 'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'gray'];

export const materialColor = (colorId: string): string =>
  colorId === 'any' ? '#6B7A92'
    : colorId === 'black' ? '#1a1a1a'
    : colorId === 'white' ? '#f0f0f0'
    : colorId === 'red' ? '#e53e3e'
    : colorId === 'blue' ? '#3182ce'
    : colorId === 'green' ? '#38a169'
    : colorId === 'yellow' ? '#d69e2e'
    : colorId === 'orange' ? '#dd6b20'
    : colorId === 'purple' ? '#805ad5'
    : '#a0aec0';

export interface PreviewMaterialOptions {
  /** Keep back faces visible (matches the viewer's current DoubleSide behaviour). */
  doubleSide?: boolean;
  /** Preserve PLY per-vertex colours so vertex-coloured models keep their data. */
  vertexColors?: boolean;
}

/**
 * Resolves the selected (material, colour) pair into a concrete
 * MeshPhysicalMaterial. Returns a NEW material instance on every call so each
 * model owns its resources; callers are responsible for disposing the previous
 * instance when it is replaced.
 */
export const buildPreviewMaterial = (
  materialId: string | null | undefined,
  colorId: string | null | undefined,
  options: PreviewMaterialOptions = {},
): THREE.MeshPhysicalMaterial => {
  const preset = resolvePreviewPreset(materialId);
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(materialColor(colorId || 'any')),
    roughness: preset.roughness,
    metalness: preset.metalness,
    specularIntensity: preset.specularIntensity,
    envMapIntensity: preset.envMapIntensity,
    side: options.doubleSide === false ? THREE.FrontSide : THREE.DoubleSide,
    vertexColors: options.vertexColors === true,
  });
  if (preset.clearcoat !== undefined) material.clearcoat = preset.clearcoat;
  if (preset.clearcoatRoughness !== undefined) material.clearcoatRoughness = preset.clearcoatRoughness;
  if (preset.sheen !== undefined) material.sheen = preset.sheen;
  if (preset.sheenRoughness !== undefined) material.sheenRoughness = preset.sheenRoughness;
  return material;
};