import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  isPreviewMaterial,
  resolvePreviewPreset,
  materialColor,
  MATERIAL_COLORS,
  buildPreviewMaterial,
  PREVIEW_MATERIALS,
} from './materialPreview';

describe('isPreviewMaterial', () => {
  it('returns true for the four FDM material ids', () => {
    expect(isPreviewMaterial('pla')).toBe(true);
    expect(isPreviewMaterial('abs')).toBe(true);
    expect(isPreviewMaterial('petg')).toBe(true);
    expect(isPreviewMaterial('tpu')).toBe(true);
  });
  it('returns false for unknown material ids', () => {
    expect(isPreviewMaterial('nylon')).toBe(false);
    expect(isPreviewMaterial(null)).toBe(false);
    expect(isPreviewMaterial(undefined)).toBe(false);
  });
});

describe('resolvePreviewPreset', () => {
  it('returns the matching preset for a known id', () => {
    expect(resolvePreviewPreset('abs')).toBe(PREVIEW_MATERIALS.abs);
  });
  it('falls back to the default preset for unknown or missing ids', () => {
    expect(resolvePreviewPreset('nylon')).toBe(PREVIEW_MATERIALS.pla);
    expect(resolvePreviewPreset(null)).toBe(PREVIEW_MATERIALS.pla);
    expect(resolvePreviewPreset(undefined)).toBe(PREVIEW_MATERIALS.pla);
  });
});

describe('materialColor', () => {
  it('returns the expected hex for each named color', () => {
    expect(materialColor('any')).toBe('#6B7A92');
    expect(materialColor('black')).toBe('#1a1a1a');
    expect(materialColor('white')).toBe('#f0f0f0');
    expect(materialColor('red')).toBe('#e53e3e');
    expect(materialColor('blue')).toBe('#3182ce');
    expect(materialColor('green')).toBe('#38a169');
    expect(materialColor('yellow')).toBe('#d69e2e');
    expect(materialColor('orange')).toBe('#dd6b20');
    expect(materialColor('purple')).toBe('#805ad5');
  });
  it('returns a neutral gray for unknown color ids', () => {
    expect(materialColor('teal')).toBe('#a0aec0');
    expect(materialColor('')).toBe('#a0aec0');
  });
});

describe('MATERIAL_COLORS', () => {
  it('includes at least the core palette entries', () => {
    expect(MATERIAL_COLORS).toContain('any');
    expect(MATERIAL_COLORS).toContain('black');
    expect(MATERIAL_COLORS).toContain('white');
    expect(MATERIAL_COLORS.length).toBeGreaterThanOrEqual(5);
  });
});

describe('buildPreviewMaterial', () => {
  it('returns a MeshPhysicalMaterial with the correct material preset properties', () => {
    const mat = buildPreviewMaterial('petg', 'red');
    expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(mat.roughness).toBeCloseTo(PREVIEW_MATERIALS.petg.roughness);
    expect(mat.metalness).toBeCloseTo(PREVIEW_MATERIALS.petg.metalness);
    expect(mat.specularIntensity).toBeCloseTo(PREVIEW_MATERIALS.petg.specularIntensity);
    expect(mat.envMapIntensity).toBeCloseTo(PREVIEW_MATERIALS.petg.envMapIntensity);
  });
  it('applies clearcoat when present in the preset (PETG)', () => {
    const mat = buildPreviewMaterial('petg', 'any');
    expect(mat.clearcoat).toBeCloseTo(0.65);
    expect(mat.clearcoatRoughness).toBeCloseTo(0.18);
  });
  it('applies sheen when present in the preset (PLA)', () => {
    const mat = buildPreviewMaterial('pla', 'any');
    expect(mat.sheen).toBeCloseTo(0.55);
    expect(mat.sheenRoughness).toBeCloseTo(0.3);
  });
  it('uses DoubleSide by default', () => {
    const mat = buildPreviewMaterial('pla', 'any');
    expect(mat.side).toBe(THREE.DoubleSide);
  });
  it('uses FrontSide when doubleSide option is false', () => {
    const mat = buildPreviewMaterial('pla', 'any', { doubleSide: false });
    expect(mat.side).toBe(THREE.FrontSide);
  });
  it('enables vertexColors when the option is true', () => {
    const mat = buildPreviewMaterial('pla', 'any', { vertexColors: true });
    expect(mat.vertexColors).toBe(true);
  });
  it('returns a new instance on every call', () => {
    const a = buildPreviewMaterial('pla', 'any');
    const b = buildPreviewMaterial('pla', 'any');
    expect(a).not.toBe(b);
  });
  it('falls back to the default material for unknown material ids', () => {
    const mat = buildPreviewMaterial('unknown', 'any');
    expect(mat.roughness).toBeCloseTo(PREVIEW_MATERIALS.pla.roughness);
  });
});