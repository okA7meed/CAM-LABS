import { createHash } from 'node:crypto';
import { AppError } from '../utils/errors';
import { ENV } from '../config/env';
import { getCadCapabilityByExtension, UPLOAD_SUPPORTED_CAD_FORMATS } from './format-registry';
import DxfParser, { IEntity, IPoint } from 'dxf-parser';

export const SUPPORTED_CAD_FORMATS = ['STEP', 'STP', 'STL', 'OBJ', 'PLY', 'DXF', 'SVG', 'PDF', 'IGES', 'IGS'] as const;
export type SupportedCadFormat = typeof SUPPORTED_CAD_FORMATS[number];

const extensionFor = (name: string): string => {
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toUpperCase() : '';
};

export const getCadFormat = (name: string): SupportedCadFormat => {
  const extension = extensionFor(name);
  const capability = getCadCapabilityByExtension(extension);
  if (!capability?.uploadSupported || !SUPPORTED_CAD_FORMATS.includes(extension as SupportedCadFormat)) {
    throw new AppError(`Unsupported CAD format. Supported formats: ${UPLOAD_SUPPORTED_CAD_FORMATS.join(', ')}.`, 400, 'UNSUPPORTED_CAD_FORMAT');
  }
  return extension as SupportedCadFormat;
};

export const isCadMimeTypeCompatible = (format: SupportedCadFormat, mimeType: string): boolean => {
  const normalized = mimeType.split(';', 1)[0].trim().toLowerCase();
  const capability = getCadCapabilityByExtension(format);
  return normalized === '' || normalized === 'application/octet-stream' || Boolean(capability?.mimeTypes.includes(normalized));
};

export const calculateChecksum = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

export interface ScanVerdict {
  status: 'CLEAN' | 'QUARANTINED';
  reason?: string;
}

export interface FileScanner {
  scan(data: Buffer): Promise<ScanVerdict>;
}

export class LocalFileScanner implements FileScanner {
  async scan(data: Buffer): Promise<ScanVerdict> {
    const text = data.toString('latin1');
    if (text.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
      return { status: 'QUARANTINED', reason: 'Known antivirus test signature detected.' };
    }
    return { status: 'CLEAN' };
  }
}

export const createFileScanner = (): FileScanner => {
  if (ENV.NODE_ENV === 'production' && ENV.CAD_SCANNER_MODE === 'local') {
    throw new Error('A production file scanner is required.');
  }
  return new LocalFileScanner();
};

export interface ExtractedCadMetadata {
  dimensions?: string;
  volume?: string;
  meshTriangles?: string;
  metadata: Record<string, unknown>;
  dfmStatus: 'PASS' | 'WARNING' | 'CRITICAL';
  findings: string[];
}

type Point = [number, number, number];

const isFinitePoint = (point: Point): boolean => point.every(Number.isFinite);

const triangleArea = ([first, second, third]: Point[]): number => {
  const ab: Point = [second[0] - first[0], second[1] - first[1], second[2] - first[2]];
  const ac: Point = [third[0] - first[0], third[1] - first[1], third[2] - first[2]];
  return Math.hypot(
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ) / 2;
};

const isValidTriangle = (triangle: Point[]): boolean => triangle.length === 3 && triangle.every(isFinitePoint) && triangleArea(triangle) > Number.EPSILON;

const boundsFor = (points: Point[]) => {
  const minimum: Point = [Infinity, Infinity, Infinity];
  const maximum: Point = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], point[axis]);
      maximum[axis] = Math.max(maximum[axis], point[axis]);
    }
  }
  const dimensions = maximum.map((value, axis) => value - minimum[axis]) as Point;
  return { minimum, maximum, dimensions };
};

const triangleMetrics = (triangles: Point[][]) => {
  const points = triangles.flat();
  const bounds = boundsFor(points);
  let surfaceArea = 0;
  let signedVolume = 0;
  for (const [first, second, third] of triangles) {
    const ab: Point = [second[0] - first[0], second[1] - first[1], second[2] - first[2]];
    const ac: Point = [third[0] - first[0], third[1] - first[1], third[2] - first[2]];
    const cross: Point = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    surfaceArea += Math.hypot(...cross) / 2;
    signedVolume += (first[0] * (second[1] * third[2] - second[2] * third[1]) - first[1] * (second[0] * third[2] - second[2] * third[0]) + first[2] * (second[0] * third[1] - second[1] * third[0])) / 6;
  }
  return { bounds, surfaceArea, volume: Math.abs(signedVolume) };
};

const parseAsciiStl = (data: Buffer): Point[][] => {
  const text = data.toString('utf8');
  if (!/^\s*solid(?:\s|$)/i.test(text) || !/\bendsolid(?:\s|$)/i.test(text)) return [];
  const triangles: Point[][] = [];
  const facets = [...text.matchAll(/\bfacet\s+normal\b[\s\S]*?\bendfacet\b/gi)];
  for (const facet of facets) {
    const vertices = [...facet[0].matchAll(/\bvertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/gi)]
      .map((match) => [Number(match[1]), Number(match[2]), Number(match[3])] as Point);
    if (!isValidTriangle(vertices)) return [];
    triangles.push(vertices);
  }
  return triangles;
};

const parseBinaryStl = (data: Buffer): Point[][] => {
  if (data.byteLength < 84) return [];
  const count = data.readUInt32LE(80);
  if (84 + count * 50 !== data.byteLength) return [];
  const triangles: Point[][] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 84 + index * 50 + 12;
    const triangle = [0, 1, 2].map((vertex) => [data.readFloatLE(offset + vertex * 12), data.readFloatLE(offset + vertex * 12 + 4), data.readFloatLE(offset + vertex * 12 + 8)] as Point);
    if (!isValidTriangle(triangle)) return [];
    triangles.push(triangle);
  }
  return triangles;
};

const parseObj = (data: Buffer) => {
  const vertices: Point[] = [];
  const triangles: Point[][] = [];
  for (const line of data.toString('utf8').split(/\r?\n/)) {
    if (/^v\s+/.test(line)) {
      const values = line.trim().split(/\s+/).slice(1, 4).map(Number);
      if (values.length === 3 && values.every(Number.isFinite)) vertices.push(values as Point);
    }
    if (/^f\s+/.test(line)) {
      const indices = line.trim().split(/\s+/).slice(1).map((token) => Number(token.split('/')[0])).map((value) => value < 0 ? vertices.length + value : value - 1).filter((value) => Number.isInteger(value) && vertices[value]);
      for (let index = 1; index + 1 < indices.length; index += 1) {
        const triangle = [vertices[indices[0]], vertices[indices[index]], vertices[indices[index + 1]]];
        if (isValidTriangle(triangle)) triangles.push(triangle);
      }
    }
  }
  return { vertices, triangles };
};

type PlyScalarType = 'char' | 'int8' | 'uchar' | 'uint8' | 'short' | 'int16' | 'ushort' | 'uint16' | 'int' | 'int32' | 'uint' | 'uint32' | 'float' | 'float32' | 'double' | 'float64';
type PlyProperty = { name: string; type: PlyScalarType } | { name: string; countType: PlyScalarType; itemType: PlyScalarType };

const plyScalarSize = (type: PlyScalarType): number => ({ char: 1, int8: 1, uchar: 1, uint8: 1, short: 2, int16: 2, ushort: 2, uint16: 2, int: 4, int32: 4, uint: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 }[type]);

const readPlyScalar = (data: Buffer, offset: number, type: PlyScalarType, littleEndian: boolean): number => {
  const methods: Record<PlyScalarType, () => number> = {
    char: () => data.readInt8(offset), int8: () => data.readInt8(offset), uchar: () => data.readUInt8(offset), uint8: () => data.readUInt8(offset),
    short: () => littleEndian ? data.readInt16LE(offset) : data.readInt16BE(offset), int16: () => littleEndian ? data.readInt16LE(offset) : data.readInt16BE(offset),
    ushort: () => littleEndian ? data.readUInt16LE(offset) : data.readUInt16BE(offset), uint16: () => littleEndian ? data.readUInt16LE(offset) : data.readUInt16BE(offset),
    int: () => littleEndian ? data.readInt32LE(offset) : data.readInt32BE(offset), int32: () => littleEndian ? data.readInt32LE(offset) : data.readInt32BE(offset),
    uint: () => littleEndian ? data.readUInt32LE(offset) : data.readUInt32BE(offset), uint32: () => littleEndian ? data.readUInt32LE(offset) : data.readUInt32BE(offset),
    float: () => littleEndian ? data.readFloatLE(offset) : data.readFloatBE(offset), float32: () => littleEndian ? data.readFloatLE(offset) : data.readFloatBE(offset),
    double: () => littleEndian ? data.readDoubleLE(offset) : data.readDoubleBE(offset), float64: () => littleEndian ? data.readDoubleLE(offset) : data.readDoubleBE(offset),
  };
  return methods[type]();
};

const parsePly = (data: Buffer): { vertices: Point[]; triangles: Point[][]; variant?: string } => {
  const headerMatch = data.toString('latin1', 0, Math.min(data.byteLength, 65536)).match(/^ply\r?\n([\s\S]*?\r?\n)end_header\r?\n/);
  if (!headerMatch) return { vertices: [], triangles: [] };
  const headerLength = headerMatch[0].length;
  const lines = headerMatch[1].trim().split(/\r?\n/);
  const format = lines.find((line) => line.startsWith('format '))?.split(/\s+/)[1];
  if (!format || !['ascii', 'binary_little_endian', 'binary_big_endian'].includes(format)) return { vertices: [], triangles: [] };

  const elements: { name: string; count: number; properties: PlyProperty[] }[] = [];
  let current: (typeof elements)[number] | undefined;
  for (const line of lines) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] === 'element' && Number.isInteger(Number(tokens[2]))) {
      current = { name: tokens[1], count: Number(tokens[2]), properties: [] };
      elements.push(current);
    } else if (tokens[0] === 'property' && current) {
      if (tokens[1] === 'list' && tokens.length >= 5) current.properties.push({ name: tokens[4], countType: tokens[2] as PlyScalarType, itemType: tokens[3] as PlyScalarType });
      else if (tokens.length >= 3) current.properties.push({ name: tokens[2], type: tokens[1] as PlyScalarType });
    }
  }
  const vertexElement = elements.find((element) => element.name === 'vertex');
  const faceElement = elements.find((element) => element.name === 'face');
  if (!vertexElement || !faceElement || vertexElement.count < 3 || faceElement.count < 1) return { vertices: [], triangles: [] };
  const vertices: Point[] = [];
  const faceIndices: number[][] = [];

  if (format === 'ascii') {
    const rows = data.toString('utf8', headerLength).trim().split(/\r?\n/);
    let row = 0;
    for (let index = 0; index < vertexElement.count; index += 1) {
      const values = rows[row++]?.trim().split(/\s+/).map(Number) || [];
      const scalarProperties = vertexElement.properties.filter((property): property is Extract<PlyProperty, { type: PlyScalarType }> => 'type' in property);
      const point = ['x', 'y', 'z'].map((name) => values[scalarProperties.findIndex((property) => property.name === name)]) as Point;
      if (!isFinitePoint(point)) return { vertices: [], triangles: [] };
      vertices.push(point);
    }
    for (let index = 0; index < faceElement.count; index += 1) {
      const values = rows[row++]?.trim().split(/\s+/).map(Number) || [];
      const count = values[0];
      if (!Number.isInteger(count) || count < 3 || values.length < count + 1) return { vertices: [], triangles: [] };
      faceIndices.push(values.slice(1, count + 1));
    }
  } else {
    const littleEndian = format === 'binary_little_endian';
    let offset = headerLength;
    for (let index = 0; index < vertexElement.count; index += 1) {
      const values: Record<string, number> = {};
      for (const property of vertexElement.properties) {
        if (!('type' in property) || !(property.type in ({ char: 1, int8: 1, uchar: 1, uint8: 1, short: 1, int16: 1, ushort: 1, uint16: 1, int: 1, int32: 1, uint: 1, uint32: 1, float: 1, float32: 1, double: 1, float64: 1 }))) return { vertices: [], triangles: [] };
        values[property.name] = readPlyScalar(data, offset, property.type, littleEndian);
        offset += plyScalarSize(property.type);
      }
      const point: Point = [values.x, values.y, values.z];
      if (!isFinitePoint(point)) return { vertices: [], triangles: [] };
      vertices.push(point);
    }
    const listProperty = faceElement.properties.find((property): property is Extract<PlyProperty, { countType: PlyScalarType }> => 'countType' in property);
    if (!listProperty) return { vertices: [], triangles: [] };
    for (let index = 0; index < faceElement.count; index += 1) {
      const count = readPlyScalar(data, offset, listProperty.countType, littleEndian);
      offset += plyScalarSize(listProperty.countType);
      if (!Number.isInteger(count) || count < 3) return { vertices: [], triangles: [] };
      const indices: number[] = [];
      for (let item = 0; item < count; item += 1) {
        indices.push(readPlyScalar(data, offset, listProperty.itemType, littleEndian));
        offset += plyScalarSize(listProperty.itemType);
      }
      faceIndices.push(indices);
    }
  }

  const triangles: Point[][] = [];
  for (const indices of faceIndices) {
    if (indices.some((index) => !Number.isInteger(index) || !vertices[index])) return { vertices: [], triangles: [] };
    for (let index = 1; index + 1 < indices.length; index += 1) {
      const triangle = [vertices[indices[0]], vertices[indices[index]], vertices[indices[index + 1]]];
      if (!isValidTriangle(triangle)) return { vertices: [], triangles: [] };
      triangles.push(triangle);
    }
  }
  return { vertices, triangles, variant: format.toUpperCase() };
};

type DxfEntityWithGeometry = IEntity & {
  vertices?: IPoint[];
  center?: IPoint;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  position?: IPoint;
};

const dxfEntityPoints = (entity: IEntity): Point[] => {
  const geometry = entity as DxfEntityWithGeometry;
  if (geometry.vertices?.length) return geometry.vertices.map((point) => [point.x, point.y, point.z || 0]);
  if (geometry.center && Number.isFinite(geometry.radius)) {
    const start = Number.isFinite(geometry.startAngle) ? geometry.startAngle! : 0;
    const end = Number.isFinite(geometry.endAngle) ? geometry.endAngle! : Math.PI * 2;
    const sweep = end >= start ? end - start : end + Math.PI * 2 - start;
    return Array.from({ length: 65 }, (_, index) => {
      const angle = start + sweep * index / 64;
      return [geometry.center!.x + geometry.radius! * Math.cos(angle), geometry.center!.y + geometry.radius! * Math.sin(angle), geometry.center!.z || 0] as Point;
    });
  }
  if (geometry.position) return [[geometry.position.x, geometry.position.y, geometry.position.z || 0]];
  return [];
};

const DXF_UNITS: Record<number, string> = { 1: 'in', 2: 'ft', 3: 'mi', 4: 'mm', 5: 'cm', 6: 'm', 7: 'km', 8: 'microin', 9: 'mil', 10: 'yd', 11: 'angstrom', 12: 'nm', 13: 'micron', 14: 'dm' };

const parseDxf = (data: Buffer) => {
  try {
    const drawing = new DxfParser().parseSync(data.toString('utf8'));
    if (!drawing?.entities.length) return null;
    const entities = drawing.entities.map((entity) => ({ type: entity.type, points: dxfEntityPoints(entity) })).filter((entity) => entity.points.length > 1);
    const points = entities.flatMap((entity) => entity.points);
    if (points.length < 2 || points.some((point) => !isFinitePoint(point))) return null;
    const bounds = boundsFor(points);
    if (bounds.dimensions[2] > 1e-9) return null;
    const unitCode = drawing.header.$INSUNITS;
    const units = typeof unitCode === 'number' ? DXF_UNITS[unitCode] : undefined;
    return { bounds, entities, sourceEntityCount: drawing.entities.length, units };
  } catch {
    return null;
  }
};

export interface CadMetadataExtractor {
  extract(format: SupportedCadFormat, data: Buffer): ExtractedCadMetadata;
}

export class BasicCadMetadataExtractor implements CadMetadataExtractor {
  extract(format: SupportedCadFormat, data: Buffer): ExtractedCadMetadata {
    const findings: string[] = [];
    let meshTriangles: string | undefined;
    let dimensions: string | undefined;
    let volume: string | undefined;
    let metadata: Record<string, unknown> = { format, byteSize: data.byteLength, supportLevel: 'UPLOAD_ONLY', geometryStatus: 'UNAVAILABLE', viewerAsset: null };

    if (data.byteLength === 0) {
      findings.push('The CAD file is empty.');
    }

    if (format === 'STL') {
      const binaryTriangles = parseBinaryStl(data);
      const variant = binaryTriangles.length > 0 ? 'BINARY' : 'ASCII';
      const triangles = binaryTriangles.length > 0 ? binaryTriangles : parseAsciiStl(data);
      if (triangles.length === 0) {
        metadata = { ...metadata, supportLevel: 'FAILED_VALIDATION' };
        findings.push('No valid STL triangle records were found.');
      }
      else {
        const metrics = triangleMetrics(triangles);
        meshTriangles = triangles.length.toLocaleString('en-US');
        dimensions = `${metrics.bounds.dimensions.map((value) => value.toFixed(3)).join(' × ')} units`;
        volume = `${metrics.volume.toFixed(3)} cubic units`;
        metadata = { ...metadata, supportLevel: 'FULLY_SUPPORTED', geometryStatus: 'READY', viewerAsset: { available: true, format: 'STL' }, variant, units: 'unitless', unitsStatus: 'CONFIRMATION_REQUIRED', dimensions: { width: metrics.bounds.dimensions[0], height: metrics.bounds.dimensions[1], depth: metrics.bounds.dimensions[2] }, boundingBox: { min: metrics.bounds.minimum, max: metrics.bounds.maximum }, surfaceArea: metrics.surfaceArea, volume: metrics.volume, triangleCount: triangles.length, vertexCount: triangles.length * 3, faceCount: triangles.length };
      }
    } else if (format === 'OBJ') {
      const parsed = parseObj(data);
      if (parsed.vertices.length === 0 || parsed.triangles.length === 0) {
        metadata = { ...metadata, supportLevel: 'FAILED_VALIDATION' };
        findings.push('The OBJ file has no complete vertex and face data.');
      }
      else {
        const metrics = triangleMetrics(parsed.triangles);
        meshTriangles = parsed.triangles.length.toLocaleString('en-US');
        dimensions = `${metrics.bounds.dimensions.map((value) => value.toFixed(3)).join(' × ')} units`;
        volume = `${metrics.volume.toFixed(3)} cubic units`;
        metadata = { ...metadata, supportLevel: 'FULLY_SUPPORTED', geometryStatus: 'READY', viewerAsset: { available: true, format: 'OBJ' }, variant: 'TEXT', units: 'unitless', unitsStatus: 'CONFIRMATION_REQUIRED', dimensions: { width: metrics.bounds.dimensions[0], height: metrics.bounds.dimensions[1], depth: metrics.bounds.dimensions[2] }, boundingBox: { min: metrics.bounds.minimum, max: metrics.bounds.maximum }, surfaceArea: metrics.surfaceArea, volume: metrics.volume, triangleCount: parsed.triangles.length, vertexCount: parsed.vertices.length, faceCount: parsed.triangles.length };
      }
    } else if (format === 'PLY') {
      const parsed = parsePly(data);
      if (parsed.vertices.length === 0 || parsed.triangles.length === 0) {
        metadata = { ...metadata, supportLevel: 'FAILED_VALIDATION' };
        findings.push('The PLY file has no supported complete vertex and face data.');
      } else {
        const metrics = triangleMetrics(parsed.triangles);
        meshTriangles = parsed.triangles.length.toLocaleString('en-US');
        dimensions = `${metrics.bounds.dimensions.map((value) => value.toFixed(3)).join(' × ')} units`;
        volume = `${metrics.volume.toFixed(3)} cubic units`;
        metadata = { ...metadata, supportLevel: 'FULLY_SUPPORTED', geometryStatus: 'READY', viewerAsset: { available: true, format: 'PLY' }, variant: parsed.variant, units: 'unitless', unitsStatus: 'CONFIRMATION_REQUIRED', dimensions: { width: metrics.bounds.dimensions[0], height: metrics.bounds.dimensions[1], depth: metrics.bounds.dimensions[2] }, boundingBox: { min: metrics.bounds.minimum, max: metrics.bounds.maximum }, surfaceArea: metrics.surfaceArea, volume: metrics.volume, triangleCount: parsed.triangles.length, vertexCount: parsed.vertices.length, faceCount: parsed.triangles.length };
      }
    } else if (format === 'DXF') {
      const parsed = parseDxf(data);
      if (!parsed) {
        metadata = { ...metadata, supportLevel: 'FAILED_VALIDATION' };
        findings.push('The DXF file has no supported planar drawing entities.');
      } else {
        dimensions = `${parsed.bounds.dimensions[0].toFixed(3)} × ${parsed.bounds.dimensions[1].toFixed(3)} ${parsed.units || 'units'}`;
        metadata = { ...metadata, supportLevel: 'VIEWER_SUPPORTED', geometryStatus: 'READY', geometryKind: '2D', viewerAsset: { available: true, format: 'DXF' }, variant: 'ASCII_DXF', units: parsed.units || 'unitless', unitsStatus: parsed.units ? 'DECLARED' : 'CONFIRMATION_REQUIRED', dimensions: { width: parsed.bounds.dimensions[0], height: parsed.bounds.dimensions[1], depth: 0 }, boundingBox: { min: parsed.bounds.minimum, max: parsed.bounds.maximum }, entityCount: parsed.sourceEntityCount, objectCount: parsed.entities.length };
      }
    } else if (format === 'SVG') {
      const text = data.toString('utf8');
      const svg = text.match(/^\s*<svg\b[^>]*>/i)?.[0];
      if (!svg || /<script\b|<foreignObject\b|\bon\w+\s*=/i.test(text)) {
        metadata = { ...metadata, supportLevel: 'FAILED_VALIDATION' };
        findings.push('The SVG must be a standalone drawing without executable content.');
      } else {
        const viewBox = svg.match(/\bviewBox\s*=\s*["']\s*([-+\d.]+)\s+([-+\d.]+)\s+([-+\d.]+)\s+([-+\d.]+)\s*["']/i);
        const width = viewBox ? Number(viewBox[3]) : undefined;
        const height = viewBox ? Number(viewBox[4]) : undefined;
        dimensions = width !== undefined && height !== undefined ? `${width.toFixed(3)} × ${height.toFixed(3)} viewBox units` : undefined;
        metadata = { ...metadata, supportLevel: 'VIEWER_SUPPORTED', geometryStatus: 'READY', geometryKind: '2D', viewerAsset: { available: true, format: 'SVG' }, variant: 'SVG', dimensions: width !== undefined && height !== undefined ? { width, height, depth: 0 } : undefined, units: 'unitless', unitsStatus: 'UNAVAILABLE' };
      }
    } else if (format === 'PDF') {
      if (data.subarray(0, 5).toString('ascii') !== '%PDF-') {
        metadata = { ...metadata, supportLevel: 'FAILED_VALIDATION' };
        findings.push('The PDF signature is invalid.');
      } else {
        metadata = { ...metadata, supportLevel: 'VIEWER_SUPPORTED', geometryStatus: 'READY', geometryKind: 'DOCUMENT', viewerAsset: { available: true, format: 'PDF' }, variant: 'PDF', metadataStatus: 'LIMITED' };
      }
    } else if (data.byteLength < 16) {
      findings.push('The CAD payload is too small to contain a valid model.');
    }

    if (!['STL', 'OBJ', 'PLY', 'DXF', 'SVG', 'PDF'].includes(format)) {
      findings.push(`${format} upload storage is supported, but geometry parsing and browser preview require a conversion service.`);
    }

    if (findings.length === 0 && !dimensions) dimensions = undefined;
    const dfmStatus = findings.length === 0 ? 'PASS' : 'WARNING';
    return {
      dimensions,
      volume,
      meshTriangles,
      metadata,
      dfmStatus,
      findings,
    };
  }
}