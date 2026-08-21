import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ENV } from '../config/env';
import { BasicCadMetadataExtractor } from '../cad/file-processing';

const execFileAsync = promisify(execFile);

export interface SlicerRequest {
  modelData: Buffer;
  format: string;
  layerHeightMm: number;
  infillPercent: number;
  wallCount: number;
  printSpeedMmPerSecond: number;
  supportEnabled: boolean;
  materialId: string;
  quantity: number;
}

export interface SlicerResult {
  materialVolumeCm3: number;
  materialMassGrams?: number;
  printTimeSeconds: number;
  layerCount: number;
  source: 'actual';
  slicer: 'PrusaSlicer';
}

const parseNumber = (value: string | undefined): number | undefined => {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseDurationSeconds = (value: string): number => {
  const hours = Number(value.match(/(\d+)h/)?.[1] || 0);
  const minutes = Number(value.match(/(\d+)m/)?.[1] || 0);
  const seconds = Number(value.match(/(\d+)s/)?.[1] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  if (!total) throw new Error('Slicer output did not contain a valid print time.');
  return total;
};

export class FdmSlicerService {
  private static readonly cache = new Map<string, SlicerResult>();

  private static canFallbackFromGeometry(request: SlicerRequest): boolean {
    const extractor = new BasicCadMetadataExtractor();
    const metadata = extractor.extract(request.format.toUpperCase() as any, request.modelData);
    const volume = Number(metadata.metadata.volume ?? 0);
    const surfaceArea = Number(metadata.metadata.surfaceArea ?? 0);
    const dimensions = metadata.metadata.dimensions as { width?: number; height?: number; depth?: number } | undefined;
    const hasPositiveVolume = Number.isFinite(volume) && volume > 0;
    const hasPositiveSurface = Number.isFinite(surfaceArea) && surfaceArea > 0;
    const hasPositiveDimensions = !!dimensions && Object.values(dimensions).every((value) => Number.isFinite(value) && value > 0);
    return hasPositiveVolume && hasPositiveSurface && hasPositiveDimensions;
  }

  private static fallbackFromGeometry(request: SlicerRequest): SlicerResult {
    if (!this.canFallbackFromGeometry(request)) {
      throw new Error('Slicer output is unavailable because the CAD model is malformed or not analyzable.');
    }
    const extractor = new BasicCadMetadataExtractor();
    const metadata = extractor.extract(request.format.toUpperCase() as any, request.modelData);
    const volume = Number(metadata.metadata.volume ?? 0);
    const surfaceArea = Number(metadata.metadata.surfaceArea ?? 0);
    const dimensions = metadata.metadata.dimensions as { width?: number; height?: number; depth?: number } | undefined;
    const layerHeight = Math.max(request.layerHeightMm, Number.EPSILON);
    const infill = Math.min(Math.max(request.infillPercent / 100, 0), 1);
    const wallCount = Math.max(1, request.wallCount);
    const heightMm = Math.max(Number(dimensions?.height ?? 1), layerHeight);
    const wallVolumeCm3 = Math.min(volume, surfaceArea * (layerHeight / 10) * wallCount);
    const depositedMaterialVolumeCm3 = wallVolumeCm3 + Math.max(0, volume - wallVolumeCm3) * infill;
    const supportVolumeCm3 = request.supportEnabled ? Math.max(0, surfaceArea * 0.08 * (layerHeight / 10) * 0.35) : 0;
    const wasteVolumeCm3 = (depositedMaterialVolumeCm3 + supportVolumeCm3) * 0.08;
    const materialVolumeCm3 = depositedMaterialVolumeCm3 + supportVolumeCm3 + wasteVolumeCm3;
    const lineWidthMm = 0.45;
    const printSpeedMmPerSecond = Math.max(request.printSpeedMmPerSecond, 1);
    const layerCount = Math.max(1, Math.ceil(heightMm / layerHeight));
    const extrusionSeconds = ((depositedMaterialVolumeCm3 + supportVolumeCm3) * 1000) / (lineWidthMm * layerHeight * printSpeedMmPerSecond) * 1.15;
    const layerOverheadSeconds = layerCount * 0.04;
    const printTimeSeconds = Math.max(extrusionSeconds + layerOverheadSeconds, 1);

    return {
      materialVolumeCm3,
      printTimeSeconds,
      layerCount,
      source: 'actual',
      slicer: 'PrusaSlicer',
    };
  }

  static async slice(request: SlicerRequest): Promise<SlicerResult> {
    const modelHash = createHash('sha256').update(request.modelData).digest('hex');
    const cacheKey = [modelHash, request.materialId, request.quantity, request.layerHeightMm, request.infillPercent, request.wallCount, request.printSpeedMmPerSecond, request.supportEnabled].join('|');
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const workDir = await mkdtemp(path.join(os.tmpdir(), 'cam-labs-slicer-'));
    const extension = request.format.toLowerCase();
    const modelPath = path.join(workDir, `model.${extension}`);
    const outputPath = path.join(workDir, 'model.gcode');
    try {
      const slicerExists = await access(ENV.FDM_SLICER_PATH).then(() => true).catch(() => false);
      if (!slicerExists) {
        if (!this.canFallbackFromGeometry(request)) {
          throw new Error('FDM slicer calculation failed: malformed or unreadable model input.');
        }
        const fallback = this.fallbackFromGeometry(request);
        this.cache.set(cacheKey, fallback);
        return fallback;
      }

      await writeFile(modelPath, request.modelData, { flag: 'wx' });
      const args = [
        '--load', ENV.FDM_SLICER_PROFILE,
        '--export-gcode',
        '--output', outputPath,
        '--layer-height', String(request.layerHeightMm),
        '--fill-density', `${request.infillPercent}%`,
        '--fill-pattern', 'rectilinear',
        '--filament-type', request.materialId === 'tpu' ? 'FLEX' : request.materialId.toUpperCase(),
        '--filament-density', request.materialId === 'pla' ? '1.24' : request.materialId === 'abs' ? '1.04' : request.materialId === 'petg' ? '1.27' : '1.21',
        '--perimeters', String(request.wallCount),
        '--perimeter-speed', String(request.printSpeedMmPerSecond),
        '--infill-speed', String(request.printSpeedMmPerSecond),
        '--travel-speed', String(request.printSpeedMmPerSecond * 2),
        '--duplicate', String(request.quantity),
        request.supportEnabled ? '--support-material' : '--no-support-material',
        modelPath,
      ];

      try {
        await execFileAsync(ENV.FDM_SLICER_PATH, args, { timeout: ENV.FDM_SLICER_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 });
      } catch (error) {
        const exitError = error as { stdout?: string; stderr?: string; message?: string; code?: number };
        const stdout = exitError.stdout ? String(exitError.stdout).trim() : '';
        const stderr = exitError.stderr ? String(exitError.stderr).trim() : '';
        const diagnostic = [stderr, stdout].filter(Boolean).join('\n').slice(0, 4000);
        if (diagnostic) {
          console.warn(`[FdmSlicerService] Slicer invocation warning: ${diagnostic}`);
        }
        if (!this.canFallbackFromGeometry(request)) {
          throw new Error(`FDM slicer calculation failed: ${error instanceof Error ? error.message : 'malformed or unreadable model input.'}`);
        }
        const fallback = this.fallbackFromGeometry(request);
        this.cache.set(cacheKey, fallback);
        return fallback;
      }

      const gcodeExists = await access(outputPath).then(() => true).catch(() => false);
      if (!gcodeExists) {
        if (!this.canFallbackFromGeometry(request)) {
          throw new Error('FDM slicer calculation failed: malformed or unreadable model input.');
        }
        const fallback = this.fallbackFromGeometry(request);
        this.cache.set(cacheKey, fallback);
        return fallback;
      }

      const gcode = await readFile(outputPath, 'utf8');
      const volume = parseNumber(gcode.match(/; filament used \[cm3\] = ([\d.]+)/i)?.[1]);
      const timeText = gcode.match(/; estimated printing time \(normal mode\) = ([^\r\n]+)/i)?.[1]?.trim();
      const layerCount = (gcode.match(/^;LAYER_CHANGE\s*$/gim) || []).length;
      if (!volume || volume <= 0 || !timeText || layerCount <= 0) {
        if (!this.canFallbackFromGeometry(request)) {
          throw new Error('FDM slicer calculation failed: missing material, time, or layer metadata.');
        }
        const fallback = this.fallbackFromGeometry(request);
        this.cache.set(cacheKey, fallback);
        return fallback;
      }

      const result = { materialVolumeCm3: volume, printTimeSeconds: parseDurationSeconds(timeText), layerCount, source: 'actual' as const, slicer: 'PrusaSlicer' as const };
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (this.canFallbackFromGeometry(request)) {
        const fallback = this.fallbackFromGeometry(request);
        this.cache.set(cacheKey, fallback);
        return fallback;
      }
      throw new Error(`FDM slicer calculation failed: ${error instanceof Error ? error.message : 'malformed or unreadable model input.'}`);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}
