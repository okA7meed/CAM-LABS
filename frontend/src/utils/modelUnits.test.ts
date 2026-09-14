import { describe, it, expect } from 'vitest';
import { convertLength, convertArea, convertVolume, scaleDimensions, formatModelValue } from './modelUnits';

describe('convertLength', () => {
  it('leaves same-unit values unchanged', () => {
    expect(convertLength(10, 'mm', 'mm')).toBe(10);
  });
  it('round-trips mm → in → mm', () => {
    const mm = convertLength(1, 'in', 'mm');
    expect(mm).toBeCloseTo(25.4);
    expect(convertLength(mm, 'mm', 'in')).toBeCloseTo(1);
  });
  it('converts cm → m correctly', () => {
    expect(convertLength(100, 'cm', 'm')).toBeCloseTo(1);
  });
});

describe('convertArea', () => {
  it('squares the length factor', () => {
    expect(convertArea(1, 'cm', 'mm')).toBeCloseTo(100);
  });
  it('round-trips in² → mm² → in²', () => {
    const sqIn = convertArea(1, 'mm', 'in');
    expect(convertArea(sqIn, 'in', 'mm')).toBeCloseTo(1);
  });
});

describe('convertVolume', () => {
  it('cubes the length factor', () => {
    expect(convertVolume(1, 'cm', 'mm')).toBeCloseTo(1000);
  });
});

describe('scaleDimensions', () => {
  const dims = { x: 10, y: 20, z: 30 };
  it('scales other axes proportionally when changing one', () => {
    const result = scaleDimensions(dims, 'x', 20);
    expect(result.x).toBe(20);
    expect(result.y).toBeCloseTo(40);
    expect(result.z).toBeCloseTo(60);
  });
  it('returns original dimensions for non-positive values', () => {
    expect(scaleDimensions(dims, 'x', 0)).toEqual(dims);
    expect(scaleDimensions(dims, 'x', -5)).toEqual(dims);
  });
  it('returns original dimensions for non-finite input', () => {
    expect(scaleDimensions(dims, 'x', NaN)).toEqual(dims);
  });
});

describe('formatModelValue', () => {
  it('returns "Not available" for null/undefined', () => {
    expect(formatModelValue(null)).toBe('Not available');
    expect(formatModelValue(undefined)).toBe('Not available');
  });
  it('returns "Not available" for non-finite numbers', () => {
    expect(formatModelValue(NaN)).toBe('Not available');
    expect(formatModelValue(Infinity)).toBe('Not available');
  });
  it('formats finite numbers with the requested precision', () => {
    expect(formatModelValue(123.456, 2)).toBe('123.46');
    expect(formatModelValue(0.001, 3)).toBe('0.001');
  });
});