export type ModelUnit = 'mm' | 'cm' | 'in' | 'm';

export interface ModelDimensions {
  x: number;
  y: number;
  z: number;
}

export interface ModelMetrics {
  dimensions: ModelDimensions;
  volume: number | null;
  surfaceArea: number | null;
  triangleCount: number | null;
}

export const UNIT_FACTORS: Record<ModelUnit, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  m: 1000,
};

export const convertLength = (value: number, from: ModelUnit, to: ModelUnit): number => value * UNIT_FACTORS[from] / UNIT_FACTORS[to];
export const convertArea = (value: number, from: ModelUnit, to: ModelUnit): number => value * (UNIT_FACTORS[from] / UNIT_FACTORS[to]) ** 2;
export const convertVolume = (value: number, from: ModelUnit, to: ModelUnit): number => value * (UNIT_FACTORS[from] / UNIT_FACTORS[to]) ** 3;

export const scaleDimensions = (dimensions: ModelDimensions, axis: keyof ModelDimensions, nextValue: number): ModelDimensions => {
  const oldValue = dimensions[axis];
  if (!Number.isFinite(nextValue) || nextValue <= 0 || !Number.isFinite(oldValue) || oldValue <= 0) return dimensions;
  const scale = nextValue / oldValue;
  return {
    x: axis === 'x' ? nextValue : dimensions.x * scale,
    y: axis === 'y' ? nextValue : dimensions.y * scale,
    z: axis === 'z' ? nextValue : dimensions.z * scale,
  };
};

export const formatModelValue = (value: number | null | undefined, maximumFractionDigits = 2): string => value === null || value === undefined || !Number.isFinite(value)
  ? 'Not available'
  : new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
